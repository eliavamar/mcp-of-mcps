#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { MCPConnection } from "./mcpConnection.js";
import { ServersRegistry } from "./serversRegistry.js";
import { SandboxManager } from "./sandboxManager.js";
import { MCPToolsParser } from "./mcpToolsParser.js";
import { McpServerConnectionConfig } from "./types.js";
import { getServersOverviewToolDefinition, TOOL_DEFINITIONS } from "./prompts.js";
import { VectorStore } from "./vectorStore.js";

export class McpOfMcps {
  private mcpServer: McpServer;
  private config: McpServerConnectionConfig[];
  private sandboxManager: SandboxManager;
  private mcpConnection: MCPConnection;
  private serversRegistry: ServersRegistry;
  private toolsParser: MCPToolsParser;
  private vectorStore: VectorStore;

  constructor(config: McpServerConnectionConfig[]) {
    this.config = config;
    this.mcpConnection = new MCPConnection();
    this.serversRegistry = new ServersRegistry(this.mcpConnection);
    this.sandboxManager = new SandboxManager();
    this.toolsParser = new MCPToolsParser();
    this.vectorStore = new VectorStore();
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
      const serversOverViewTool: Tool =  getServersOverviewToolDefinition(this.toolsParser.getServersOverview(this.serversRegistry.getAllServers()));
      
      const tools = [...TOOL_DEFINITIONS, serversOverViewTool];
      return { tools: tools };
    });

    // Route tool calls to appropriate child server or handle custom tools
    this.mcpServer.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Handle our custom tools
      if (name === "get_mcps_servers_overview") {
        const overview = this.toolsParser.getServersOverview(this.serversRegistry.getAllServers());
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

        const toolsJson = this.toolsParser.getToolsOverview(this.serversRegistry.getAllServers(), toolPaths);
        return {
          content: [
            {
              type: "text",
              text: toolsJson,
            },
          ],
        };
      }

      if (name === "semantic_search_tools") {
        const { query, limit = 5 } = args as { query: string; limit?: number };
        
        if (typeof query !== "string") {
          return {
            content: [
              {
                type: "text",
                text: "Error: query must be a string",
              },
            ],
          };
        }

        try {
          const results = await this.vectorStore.search(query, limit);
          
          const formattedResults = results.map(r => ({
            serverName: r.serverName,
            toolName: r.toolName,
            description: r.description,
            similarityScore: r.score.toFixed(3),
            fullPath: `${r.serverName}/${r.toolName}`
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(formattedResults, null, 2),
              },
            ],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: "text",
                text: `Error searching tools: ${errorMessage}`,
              },
            ],
          };
        }
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

    // Initialize and index tools in vector store
    await this.vectorStore.initialize();
    await this.vectorStore.indexTools(this.serversRegistry.getAllServers());

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
