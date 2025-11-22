import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ServerInfo, StoredTool } from "../../domain/types.js";
import { IServerRegistry } from "../../interfaces/IServerRegistry.js";
import { IConnectionManager } from "../../interfaces/IConnectionManager.js";
import { IServersToolDatabase } from "../../interfaces/IToolDatabase.js";
import { convertToolName } from "../../utils.js";

/**
 * ServerRegistryService manages server connections, clients, and tools
 * Provides a centralized way to access and manage MCP server information
 * Implements dependency injection pattern for better testability
 */
export class ServerRegistryService implements IServerRegistry {
  private serversInfo: Map<string, ServerInfo> = new Map();
  private connectionManager: IConnectionManager;
  private toolDatabase: IServersToolDatabase;

  /**
   * Constructor
   * @param connectionManager - The connection manager instance
   * @param toolDatabase - The tool database instance
   */
  constructor(connectionManager: IConnectionManager, toolDatabase: IServersToolDatabase) {
    this.connectionManager = connectionManager;
    this.toolDatabase = toolDatabase;
  }

  /**
   * Register a server with its client and tools
   * @param serverName - Name of the server
   * @throws Error if server connection not found or server already registered
   */
  async registerServer(serverName: string): Promise<void> {
    if (this.serversInfo.has(serverName)) {
      throw new Error(`Server '${serverName}' is already registered`);
    }

    const client = this.connectionManager.getConnection(serverName);
    if (!client) {
      throw new Error(`Connection for server '${serverName}' not found`);
    }

    try {
      // Fetch tools from the server
      const tools = await this.fetchServerTools(client);
      
      // Sync tools to database
      await this.syncToolsToDatabase(serverName, tools);
      
      // Store server info
      const serverInfo: ServerInfo = {
        name: serverName,
        client: client,
        tools: tools,
      };

      this.serversInfo.set(serverName, serverInfo);
      console.error(`✓ Registered server '${serverName}' with ${tools.length} tools`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`✗ Failed to register server '${serverName}':`, error);
      throw new Error(`Failed to register server '${serverName}': ${errorMessage}`);
    }
  }

  /**
   * Register all servers from configurations
   * Creates connections and registers each server
   */
  async registerAllServers(): Promise<void> {
    const connections = this.connectionManager.getAllConnections();
    const registrationPromises: Promise<void>[] = [];

    for (const [serverName] of connections) {
      registrationPromises.push(
        this.registerServer(serverName).catch((error) => {
          console.error(`Failed to register ${serverName}:`, error);
        })
      );
    }

    await Promise.all(registrationPromises);
    console.error(`✓ Registered ${this.serversInfo.size} servers`);

    // Clean up orphaned servers from database
    await this.cleanupOrphanedServers();
  }

  /**
   * Delete servers from database that are no longer in the configuration
   */
  private async cleanupOrphanedServers(): Promise<void> {
    try {
      // Get all server names from database
      const dbServerNames = await this.toolDatabase.getAllServerNames();
      
      // Get all configured server names
      const configuredServerNames = new Set(this.serversInfo.keys());

      // Check for orphaned servers
      for (const dbServerName of dbServerNames) {
        if (!configuredServerNames.has(dbServerName)) {
          // Server exists in DB but not in configuration - delete it
          console.error(`[ToolDatabase] Deleting orphaned server '${dbServerName}' from database`);
          await this.toolDatabase.deleteServerTools(dbServerName);
        }
      }
    } catch (error) {
      console.error('[ToolDatabase] Error cleaning up orphaned servers:', error);
    }
  }

  /**
   * Create connections for all servers in configuration
   * @param configs - Array of server configurations
   */
  async createConnections(configs: Array<{ name: string; command: string; args: string[]; env?: Record<string, string> }>): Promise<void> {
    const connectionPromises = configs.map(config =>
      this.connectionManager.createConnection(config).catch(error => {
        console.error(`Failed to create connection for ${config.name}:`, error);
      })
    );
    await Promise.all(connectionPromises);
  }

  /**
   * Get server information by name
   * @param serverName - Name of the server
   * @returns ServerInfo or undefined if not found
   */
  getServer(serverName: string): ServerInfo | undefined {
    return this.serversInfo.get(serverName);
  }

  /**
   * Get client for a specific server
   * @param serverName - Name of the server
   * @returns Client or undefined if not found
   */
  getClient(serverName: string): Client | undefined {
    return this.serversInfo.get(serverName)?.client;
  }

  /**
   * Get all registered servers
   * @returns Map of all registered servers (serverName -> ServerInfo)
   */
  getAllServers(): Map<string, ServerInfo> {
    return this.serversInfo;
  }

  /**
   * Get a tool by name from a specific server
   * @param serverName - Name of the server
   * @param toolName - Name of the tool
   * @returns Tool or undefined if not found
   */
  getTool(serverName: string, toolName: string): Tool | undefined {
    const serverInfo = this.serversInfo.get(serverName);
    if (!serverInfo) {
      throw new Error(`Server '${serverName}' not found in registry`);
    }
    return serverInfo.tools.find((tool) => tool.name === toolName);
  }

  /**
   * Get total number of tools across all servers
   * @returns Total number of tools
   */
  getTotalToolCount(): number {
    let count = 0;
    for (const serverInfo of this.serversInfo.values()) {
      count += serverInfo.tools.length;
    }
    return count;
  }

  /**
   * Fetch tools from a server and convert tool names
   * @param client - The client connection
   * @returns Array of tools with converted names
   */
  private async fetchServerTools(client: Client): Promise<Tool[]> {
    const response = await client.listTools();
    // Convert the tool name to ignore syntax error when execute js code in sandbox
    response.tools.forEach(tool => tool.title = convertToolName(tool.name));
    return response.tools;
  }

  /**
   * Sync tools to database with comparison logic and orphan deletion
   * Only stores output schema
   * @param serverName - The server name
   * @param tools - The tools to sync
   */
  private async syncToolsToDatabase(serverName: string, tools: Tool[]): Promise<void> {

    // Get current tools from MCP server as a Set for quick lookup
    const mcpToolNames = new Set(tools.map(tool => tool.name));

    // Get all tools from database for this server
    const dbTools = await this.toolDatabase.getServerTools(serverName);

    // Check for orphaned tools (in DB but not in MCP server anymore)
    for (const dbTool of dbTools) {
      if (!mcpToolNames.has(dbTool.toolName)) {
        // Tool exists in DB but not in MCP server - delete it
        try {
          await this.toolDatabase.deleteTool(serverName, dbTool.toolName);
          console.error(`[ToolDatabase] Deleted orphaned tool '${dbTool.toolName}' from server '${serverName}'`);
        } catch (error) {
          console.error(`[ToolDatabase] Error deleting orphaned tool '${dbTool.toolName}' from server '${serverName}':`, error);
        }
      }
    }

    // Sync current tools from MCP server
    for (const tool of tools) {
      try {
          // Compare tool with database version
          const dbTool = await this.toolDatabase.getTool(serverName, tool.name);
          if (!dbTool) {
            // New tool - save to database (only output schema)
            const storedTool: StoredTool = {
              serverName,
              toolName: tool.name,
              outputSchema: tool.outputSchema ? JSON.stringify(tool.outputSchema) : undefined,
              originalOutputSchema: tool.outputSchema ? true : false,
              lastUpdated: Date.now(),
            };
            await this.toolDatabase.saveTool(storedTool);
          } else {
            if (tool.outputSchema) {
              await this.toolDatabase.updateTool(serverName, tool.name, JSON.stringify(tool.outputSchema), true);
            }
            else{
              tool.outputSchema = dbTool?.outputSchema ? JSON.parse(dbTool.outputSchema) : undefined;
            }
          }
      } catch (error) {
        console.error(`[ToolDatabase] Error syncing tool '${tool.name}' from server '${serverName}':`, error);
      }
    }

  }
}
