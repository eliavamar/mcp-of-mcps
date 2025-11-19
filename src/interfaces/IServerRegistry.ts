import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { McpServerConnectionConfig, ServerInfo } from "../domain/types.js";

/**
 * Interface for managing server registry
 */
export interface IServerRegistry {

  /**
   * Create connections for all servers in configuration
   * @param configs - Array of server configurations
   */
  createConnections(config: McpServerConnectionConfig[]): Promise<void>;
  
  /**
   * Register a server with its client and tools
   * @param serverName - Name of the server
   * @throws Error if server connection not found or server already registered
   */
  registerServer(serverName: string): Promise<void>;

  /**
   * Register all connected servers
   */
  registerAllServers(): Promise<void>;

  /**
   * Get server information by name
   * @param serverName - Name of the server
   * @returns ServerInfo or undefined if not found
   */
  getServer(serverName: string): ServerInfo | undefined;

  /**
   * Get client for a specific server
   * @param serverName - Name of the server
   * @returns Client or undefined if not found
   */
  getClient(serverName: string): Client | undefined;

  /**
   * Get all registered servers
   * @returns Map of all registered servers (serverName -> ServerInfo)
   */
  getAllServers(): Map<string, ServerInfo>;

  /**
   * Get a tool by name from a specific server
   * @param serverName - Name of the server
   * @param toolName - Name of the tool
   * @returns Tool or undefined if not found
   */
  getTool(serverName: string, toolName: string): Tool | undefined;

  /**
   * Get total number of tools across all servers
   * @returns Total number of tools
   */
  getTotalToolCount(): number;
}
