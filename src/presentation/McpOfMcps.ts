#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { McpServerConnectionConfig } from "../domain/types.js";
import { IServerRegistry } from "../interfaces/IServerRegistry.js";
import { IVectorStore } from "../interfaces/IVectorStore.js";
import { ISandboxManager } from "../interfaces/ISandboxManager.js";
import { IServersToolDatabase } from "../interfaces/IToolDatabase.js";
import { ToolCallHandler } from "../application/handlers/ToolCallHandler.js";
import { IToolsParser } from "../interfaces/IToolsParser.js";
import { TOOL_DEFINITIONS, getServersOverviewToolDefinition } from "./prompts/PromptDefinitions.js";
import { ArgsValidator } from "../application/validators/ArgsValidator.js";

/**
 * McpOfMcps - Main presentation layer class
 * Orchestrates the MCP server and delegates to application services
 * Implements dependency injection pattern for better testability
 */
export class McpOfMcps {
  private mcpServer: McpServer;
  private config: McpServerConnectionConfig[];
  private toolCallHandler: ToolCallHandler;
  private serverRegistry: IServerRegistry;
  private vectorStore: IVectorStore;
  private sandboxManager: ISandboxManager;
  private toolsParser: IToolsParser;
  private toolDatabase: IServersToolDatabase;

  constructor(
    config: McpServerConnectionConfig[],
    toolCallHandler: ToolCallHandler,
    serverRegistry: IServerRegistry,
    vectorStore: IVectorStore,
    sandboxManager: ISandboxManager,
    toolsParser: IToolsParser,
    toolDatabase: IServersToolDatabase
  ) {
    this.config = config;
    this.toolCallHandler = toolCallHandler;
    this.serverRegistry = serverRegistry;
    this.vectorStore = vectorStore;
    this.sandboxManager = sandboxManager;
    this.toolsParser = toolsParser;
    this.toolDatabase = toolDatabase;
    
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
    
    this.setupHandlers(this.mcpServer);
  }

  /**
   * Setup MCP server request handlers
   */
  private setupHandlers(mcpServer: McpServer): void {
    // List all tools from all child servers plus our custom tools
    mcpServer.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const serversOverViewTool: Tool = getServersOverviewToolDefinition(
        this.toolsParser.getServersOverview(this.serverRegistry.getAllServers())
      );
      
      const tools = [...TOOL_DEFINITIONS, serversOverViewTool];
      return { tools: tools };
    });

    // Route tool calls to appropriate handlers
    mcpServer.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Route to appropriate handler based on tool name
      switch (name) {
        case "get_mcps_servers_overview":
          return await this.toolCallHandler.handleGetServersOverview();
        
        case "get_tools_overview": {
          const validation = ArgsValidator.validateGetToolsOverview(args);
          if (!validation.success) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: ${validation.error}`,
                }
              ]
            };
          }
          return await this.toolCallHandler.handleGetToolsOverview(validation.data!);
        }
        
        case "semantic_search_tools": {
          const validation = ArgsValidator.validateSemanticSearch(args);
          if (!validation.success) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: ${validation.error}`,
                }
              ]
            };
          }
          return await this.toolCallHandler.handleSemanticSearch(validation.data!);
        }
        
        case "run_functions_code": {
          const validation = ArgsValidator.validateRunCode(args);
          if (!validation.success) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: ${validation.error}`,
                }
              ]
            };
          }
          return await this.toolCallHandler.handleRunCode(validation.data!);
        }
        
        default:
          return {
            content: [
              {
                type: "text",
                text: `Tool '${name}' not found`,
              }
            ]
          };
      }
    });
  }

  /**
   * Initialize connections to all configured MCP servers
   */
  private async initializeConnections(): Promise<void> {
    // Connection creation is handled by the ServerRegistry
    // which uses ConnectionManager internally
  }

  /**
   * Initialize all components (database, vector store, sandbox)
   */
  private async initializeComponents(): Promise<void> {
    // Initialize database before creating connections
    await this.toolDatabase.initialize();
    
    // Create connections for all configured servers
    await this.serverRegistry.createConnections(this.config);
    
    // Register all connected servers (tools will be synced to database automatically)
    await this.serverRegistry.registerAllServers();

    // Initialize and index tools in vector store
    await this.vectorStore.initialize();
    await this.vectorStore.indexTools(this.serverRegistry.getAllServers());

    // Setup sandbox with all server tools
    this.sandboxManager.initialize(this.serverRegistry.getAllServers());

    // Log database statistics
    const stats = this.toolDatabase.getStats();
    console.error(`[ToolDatabase] Stats: ${stats.totalTools} tools stored`);

    console.error(
      `MCP Of MCPS started with ${this.serverRegistry.getAllServers().size} mcp servers`
    );
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    // Initialize connections first
    await this.initializeConnections();
    
    // Initialize all components
    await this.initializeComponents();

    // Start the main server
    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);
  }
}
