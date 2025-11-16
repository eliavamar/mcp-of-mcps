import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { McpServerConnectionConfig } from "./types.js";

/**
 * MCPConnection handles connections to multiple MCP child servers
 */
export class MCPConnection {
  private connections: Map<string, Client> = new Map();

  /**
   * Constructor to create a new MCPConnection instance
   */
  constructor() {}

  /**
   * Create a new connection to an MCP server
   * @param config - Server configuration
   * @returns The connected Client instance
   * @throws Error if connection fails
   */
  async createConnection(config: McpServerConnectionConfig): Promise<Client> {
    if (this.connections.has(config.name)) {
      console.error(`Connection '${config.name}' already exists`);
      return this.connections.get(config.name)!;
    }

    try {
      console.error(`Connecting to MCP server: ${config.name}`);

      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env,
        stderr: "pipe",
      });

      const client = new Client(
        {
          name: `${config.name}-client`,
          version: "1.0.0",
        },
        {
          capabilities: {},
        }
      );

      await client.connect(transport);
      
      // Store connection
      this.connections.set(config.name, client);
      

      console.error(`✓ Connected to ${config.name}`);
      return client;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`✗ Failed to connect to ${config.name}:`, error);
      throw new Error(`Failed to connect to ${config.name}: ${errorMessage}`);
    }
  }

  /**
   * Get an existing connection by server name
   * @param serverName - Name of the server
   * @returns The Client instance or undefined if not found
   */
  getConnection(serverName: string): Client | undefined {
    return this.connections.get(serverName);
  }

  /**
   * Get all active connections
   * @returns Map of all connections (serverName -> Client)
   */
  getAllConnections(): Map<string, Client> {
    return new Map(this.connections);
  }

  /**
   * Get the number of active connections
   * @returns Number of active connections
   */
  getConnectionCount(): number {
    return this.connections.size;
  }
}
