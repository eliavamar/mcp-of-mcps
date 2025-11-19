import { ServerInfo } from "../domain/types.js";

/**
 * Interface for parsing and formatting tool information
 */
export interface IToolsParser {
  /**
   * Generate a tree overview of all MCP servers and their tools
   * @param servers - Map of server information
   * @returns Formatted string with server overview
   */
  getServersOverview(servers: Map<string, ServerInfo>): string;

  /**
   * Get detailed overview for specific tools by their paths
   * @param servers - Map of server information
   * @param toolPaths - Array of tool paths in format "serverName/toolName"
   * @returns JSON stringified array of tools with details
   */
  getToolsOverview(servers: Map<string, ServerInfo>, toolPaths: string[]): string;
}
