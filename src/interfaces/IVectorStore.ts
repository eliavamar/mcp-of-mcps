import { ServerInfo, SearchResult } from "../domain/types.js";

/**
 * Interface for vector store operations
 */
export interface IVectorStore {
  /**
   * Initialize the vector store
   */
  initialize(): Promise<void>;

  /**
   * Index all tools from registered servers
   * @param servers - Map of server information
   */
  indexTools(servers: Map<string, ServerInfo>): Promise<void>;

  /**
   * Search for tools using semantic similarity
   * @param query - Search query
   * @param topK - Number of results to return
   * @returns Array of search results with scores
   */
  search(query: string, topK: number): Promise<SearchResult[]>;

  /**
   * Re-index a specific server's tools
   * @param serverName - Name of the server
   * @param serverInfo - Server information
   */
  reindexServer(serverName: string, serverInfo: ServerInfo): Promise<void>;

  /**
   * Get statistics about the vector store
   * @returns Object with total tools and cached embeddings count
   */
  getStats(): { totalTools: number; };
}
