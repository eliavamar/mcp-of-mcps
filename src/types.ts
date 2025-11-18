import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

// Configuration for child MCP servers
export interface McpServerConnectionConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

// Server information stored in the registry
export interface ServerInfo {
  name: string;
  client: Client;
  tools: Tool[];
}

// Vector store types
export interface VectorSearchResult {
  serverName: string;
  toolName: string;
  description: string;
  score: number;
}
