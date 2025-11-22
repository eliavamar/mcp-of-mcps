import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Configuration for child MCP servers
 */
export interface McpServerConnectionConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * Server information stored in the registry
 */
export interface ServerInfo {
  name: string;
  client: Client;
  tools: Tool[];
}

/**
 * Vector store types
 */
export interface VectorSearchResult {
  serverName: string;
  toolName: string;
  description: string;
  score: number;
}

/**
 * Tool with metadata for internal use
 */
export interface ToolWithMetadata {
  serverName: string;
  toolName: string;
  description: string;
  tool: Tool;
}

/**
 * Search result with score
 */
export interface SearchResult extends ToolWithMetadata {
  score: number;
}

/**
 * Database-stored tool representation - only stores output schema
 */
export interface StoredTool {
  id?: number;                    // Auto-increment primary key
  serverName: string;             // MCP server name
  toolName: string;               // Original tool name from server
  outputSchema?: string;          // JSON string of output schema (optional)
  originalOutputSchema: boolean; // Whether output schema is original from server
  lastUpdated: number;            // Unix timestamp of last update
}

/**
 * Tool comparison result
 */
export interface ToolComparisonResult {
  hasChanges: boolean;
  changedFields: string[];        // List of field names that changed
  shouldUpdate: boolean;          // Whether to perform database update
}

/**
 * Database statistics
 */
export interface DatabaseStats {
  totalTools: number;
  toolsByServer: Map<string, number>;
  lastUpdate: number;
}
