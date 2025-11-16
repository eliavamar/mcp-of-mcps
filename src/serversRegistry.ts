import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { MCPConnection } from "./mcpConnection.js";
import { ServerInfo } from "./types.js";

/**
 * ServersRegistry manages server connections, clients, and tools
 * Provides a centralized way to access and manage MCP server information
 */
export class ServersRegistry {
  private serversInfo: Map<string, ServerInfo> = new Map();
  private mcpConnection: MCPConnection;

  /**
   * Constructor
   * @param mcpConnection - The MCPConnection instance managing connections
   */
  constructor(mcpConnection: MCPConnection) {
    this.mcpConnection = mcpConnection;
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

    const client = this.mcpConnection.getConnection(serverName);
    if (!client) {
      throw new Error(`Connection for server '${serverName}' not found`);
    }

    try {
      // Fetch tools from the server
      const response = await client.listTools();

      // Store server info
      const serverInfo: ServerInfo = {
        name: serverName,
        client: client,
        tools: response.tools,
      };

      this.serversInfo.set(serverName, serverInfo);
      console.error(`✓ Registered server '${serverName}' with ${response.tools.length} tools`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`✗ Failed to register server '${serverName}':`, error);
      throw new Error(`Failed to register server '${serverName}': ${errorMessage}`);
    }
  }

  /**
   * Register all connected servers from MCPConnection
   */
  async registerAllServers(): Promise<void> {
    const connections = this.mcpConnection.getAllConnections();
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
   * Get all server names
   * @returns Array of server names
   */
  getServerNames(): string[] {
    return Array.from(this.serversInfo.keys());
  }

  /**
   * Get total number of registered servers
   * @returns Number of registered servers
   */
  getServerCount(): number {
    return this.serversInfo.size;
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
   * Check if a server is registered
   * @param serverName - Name of the server
   * @returns true if server is registered, false otherwise
   */
  hasServer(serverName: string): boolean {
    return this.serversInfo.has(serverName);
  }

  /**
   * Clear all registered servers
   */
  clear(): void {
    this.serversInfo.clear();
    console.error("✓ Cleared all registered servers");
  }
}
