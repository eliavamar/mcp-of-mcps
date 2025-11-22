import { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  StoredTool,
  ToolComparisonResult,
  DatabaseStats,
} from "../domain/types.js";

/**
 * Interface for tool database operations
 */
export interface IServersToolDatabase {
  /**
   * Initialize the database (create schema, tables, indexes)
   */
  initialize(): Promise<void>;

  /**
   * Save a tool to the database (insert or update)
   * @param tool The tool to save
   */
  saveTool(tool: StoredTool): Promise<void>;

  /**
   * Get a specific tool from the database
   * @param serverName The MCP server name
   * @param toolName The tool name
   * @returns The stored tool or null if not found
   */
  getTool(serverName: string, toolName: string): Promise<StoredTool | null>;

  /**
   * Get all tools for a specific server
   * @param serverName The MCP server name
   * @returns Array of tools for the server
   */
  getServerTools(serverName: string): Promise<StoredTool[]>;

  /**
   * Compare an MCP tool with its database version
   * @param mcpTool The tool from MCP server
   * @param serverName The MCP server name
   * @returns Comparison result with change details
   */


  /**
   * Update a tool in the database with special handling for output schema
   * @param serverName The MCP server name
   * @param toolName The tool name
   * @param outputSchema Output schema of the tool
   * @param originalOutputSchema Whether output schema is original from server
   */
  updateTool(
    serverName: string,
    toolName: string,
    outputSchema: string,
    originalOutputSchema: boolean
  ): Promise<void>;

  /**
   * Get all tools from the database
   * @returns Array of all stored tools
   */
  getAllTools(): Promise<StoredTool[]>;

  /**
   * Delete a tool from the database
   * @param serverName The MCP server name
   * @param toolName The tool name
   */
  deleteTool(serverName: string, toolName: string): Promise<void>;

  /**
   * Delete all tools for a specific server
   * @param serverName The MCP server name
   */
  deleteServerTools(serverName: string): Promise<void>;

  /**
   * Get all unique server names from the database
   * @returns Array of server names
   */
  getAllServerNames(): Promise<string[]>;

  /**
   * Get database statistics
   * @returns Database statistics
   */
  getStats(): DatabaseStats;

  /**
   * Close the database connection
   */
  close(): void;
}
