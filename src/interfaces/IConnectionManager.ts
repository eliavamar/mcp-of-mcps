import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServerConnectionConfig } from "../domain/types.js";

/**
 * Interface for managing connections to MCP servers
 */
export interface IConnectionManager {
  /**
   * Create a new connection to an MCP server
   * @param config - Server configuration
   * @returns The connected Client instance
   * @throws Error if connection fails
   */
  createConnection(config: McpServerConnectionConfig): Promise<Client>;

  /**
   * Get an existing connection by server name
   * @param serverName - Name of the server
   * @returns The Client instance or undefined if not found
   */
  getConnection(serverName: string): Client | undefined;

  /**
   * Get all active connections
   * @returns Map of all connections (serverName -> Client)
   */
  getAllConnections(): Map<string, Client>;

  /**
   * Get the number of active connections
   * @returns Number of active connections
   */
  getConnectionCount(): number;
}
