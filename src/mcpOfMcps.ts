#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { MCPConnection } from "./mcpConnection.js";
import { ServersRegistry } from "./serversRegistry.js";
import { SandboxManager } from "./sandboxManager.js";
import { MCPToolsParser } from "./mcpToolsParser.js";
import { McpServerConnectionConfig } from "./types.js";

export class McpOfMcps {
  private mcpServer: McpServer;
  private config: McpServerConnectionConfig[];
  private sandboxManager: SandboxManager;
  private mcpConnection: MCPConnection;
  private serversRegistry: ServersRegistry;
  private toolsParser: MCPToolsParser | null = null;

  constructor(config: McpServerConnectionConfig[]) {
    this.config = config;
    this.mcpConnection = new MCPConnection();
    this.serversRegistry = new ServersRegistry(this.mcpConnection);
    this.sandboxManager = new SandboxManager();
    this.mcpServer = new McpServer(
      {
        name: "mcp-of-mcps",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
        instructions: ""
      }
    );


    this.setupHandlers();
  }

  private setupHandlers() {
    // List all tools from all child servers plus our custom tools
    // Using the underlying server for low-level request handling needed for aggregation
    this.mcpServer.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = [
        {
          name: "get_mcps_servers_overview",
          description: "Get an overview of all connected MCP servers and their available tools. Returns a hierarchical tree structure showing each server and its tools in the format 'serverName/toolName'. This is useful for discovering what capabilities are available across all connected MCP servers before calling specific tools.",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        {
          name: "get_tools_overview",
          description: "Get detailed description of what specific tools do and how to execute them. Input is an array of tool paths in format 'serverName/toolName' for the tools you want details for.",
          inputSchema: {
            type: "object",
            properties: {
              toolPaths: {
                type: "array",
                description: "Array of tool paths in format 'serverName/toolName'",
                items: {
                  type: "string",
                },
              },
            },
            required: ["toolPaths"],
          },
        },
        {
          name: "run_functions_code",
          description: "Execute JavaScript code that can call one or more MCP server tools. This is useful for composing multiple tool calls, processing results, or implementing complex logic. The code runs in a sandboxed Node.js environment with access to all connected MCP server tools via require().",
          inputSchema: {
            type: "object",
            properties: {
              code: {
                type: "string",
                description: "JavaScript code to execute. The code must export its result using 'module.exports'. All tool calls return Promises and must be handled properly.\n\nIMPORTANT: When using 'await', wrap your code in an async IIFE (Immediately Invoked Function Expression):\n\nmodule.exports = (async () => {\n  // your async code here\n  return result;\n})();\n\nAvailable patterns:\n\n1. Single synchronous tool call (returns Promise directly):\nconst get_forecast = require('./weather/get_forecast.cjs');\nmodule.exports = get_forecast({ latitude: 40.7128, longitude: -74.0060 });\n\n2. Multiple sequential tool calls with await (MUST use async IIFE):\nconst tool1 = require('./server1/tool1.cjs');\nconst tool2 = require('./server2/tool2.cjs');\nmodule.exports = (async () => {\n  const result1 = await tool1({ param: 'value' });\n  const result2 = await tool2({ data: result1 });\n  return { result1, result2 };\n})();\n\n3. Processing tool results with await (MUST use async IIFE):\nconst get_data = require('./api/get_data.cjs');\nmodule.exports = (async () => {\n  const response = await get_data({ id: '123' });\n  const processed = response.content[0].text.toUpperCase();\n  return { original: response, processed };\n})();\n\n4. Parallel tool calls with Promise.all (MUST use async IIFE):\nconst tool1 = require('./server1/tool1.cjs');\nconst tool2 = require('./server2/tool2.cjs');\nmodule.exports = (async () => {\n  const [result1, result2] = await Promise.all([\n    tool1({ param1: 'value1' }),\n    tool2({ param2: 'value2' })\n  ]);\n  return { result1, result2 };\n})();\n\nNotes:\n- Use relative paths starting with './' (e.g., './weather/get_forecast.cjs')\n- ALWAYS wrap code with 'await' in an async IIFE: module.exports = (async () => { ... })();\n- Return your result from the async function, don't assign to module.exports inside\n- The sandbox automatically handles Promise resolution from the IIFE",
              },
            },
            required: ["code"],
          },
        },
      ];

      return { tools };
    });

    // Route tool calls to appropriate child server or handle custom tools
    this.mcpServer.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Handle our custom tools
      if (name === "get_mcps_servers_overview") {
        if (!this.toolsParser) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Tools parser not initialized. Please wait for the server to fully start.",
              },
            ],
          };
        }

        const overview = this.toolsParser.getServersOverview();
        return {
          content: [
            {
              type: "text",
              text: overview,
            },
          ],
        };
      }

      if (name === "get_tools_overview") {
        if (!this.toolsParser) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Tools parser not initialized. Please wait for the server to fully start.",
              },
            ],
          };
        }

        const toolPaths = (args as { toolPaths: string[] }).toolPaths;
        if (!Array.isArray(toolPaths)) {
          return {
            content: [
              {
                type: "text",
                text: "Error: toolPaths must be an array of strings",
              },
            ],
          };
        }

        const toolsJson = this.toolsParser.getToolsOverview(toolPaths);
        return {
          content: [
            {
              type: "text",
              text: toolsJson,
            },
          ],
        };
      }

      if (name === "run_functions_code") {
        const code = (args as { code: string }).code;
        if (typeof code !== "string") {
          return {
            content: [
              {
                type: "text",
                text: "Error: code must be a string",
              },
            ],
          };
        }

        try {
          const result = await this.sandboxManager.runCodeInSandbox(code);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: "text",
                text: `Error executing code: ${errorMessage}`,
              },
            ],
          };
        }
      }

      // If not our custom tools, this would be routed to child servers
      // (Implementation for child server routing would go here)
      return {
        content: [
          {
            type: "text",
            text: `Tool '${name}' not found`,
          },
        ],
      };
    });
  }

  private async connectMcpServer(config: McpServerConnectionConfig): Promise<void> {
    try {
      await this.mcpConnection.createConnection(config);
    } catch (error) {
      // Error already logged by MCPConnection
    }
  }

  async start() {
    // Connect to all child servers
    await Promise.all(
      this.config.map((serverConfig) => this.connectMcpServer(serverConfig))
    );

    // Register all connected servers in the registry
    await this.serversRegistry.registerAllServers();

    // Initialize tools parser with registered servers
    this.toolsParser = new MCPToolsParser(this.serversRegistry.getAllServers());

    // Setup sandbox with all server tools
    this.sandboxManager.createSendBox(this.serversRegistry.getAllServers());

    console.error(
      `MCP Of MCPS started with ${this.serversRegistry.getServerCount()} mcps servers`
    );

    // Start the main server
    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);
  }
}
