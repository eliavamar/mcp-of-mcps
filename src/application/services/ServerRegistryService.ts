import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ServerInfo } from "../../domain/types.js";
import { IServerRegistry } from "../../interfaces/IServerRegistry.js";
import { IConnectionManager } from "../../interfaces/IConnectionManager.js";

/**
 * Utility function to convert tool names (replace hyphens with underscores)
 */
function convertToolName(input: string): string {
  return input.replace(/-/g, "_");
}

/**
 * ServerRegistryService manages server connections, clients, and tools
 * Provides a centralized way to access and manage MCP server information
 * Implements dependency injection pattern for better testability
 */
export class ServerRegistryService implements IServerRegistry {
  private serversInfo: Map<string, ServerInfo> = new Map();
  private connectionManager: IConnectionManager;

  /**
   * Constructor
   * @param connectionManager - The connection manager instance
   */
  constructor(connectionManager: IConnectionManager) {
    this.connectionManager = connectionManager;
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
}
