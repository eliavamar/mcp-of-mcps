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
import { toolDefinitions } from "./prompts.js";

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
      return { tools: toolDefinitions };
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
