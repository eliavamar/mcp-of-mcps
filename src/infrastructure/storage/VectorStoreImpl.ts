import { CreateIndexConfig, LocalIndex } from 'vectra';
import { ServerInfo, ToolWithMetadata, SearchResult } from '../../domain/types.js';
import { IVectorStore } from '../../interfaces/IVectorStore.js';
import { EmbeddingsManager } from './EmbeddingsManager.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * VectorStoreImpl provides vector-based semantic search for tools
 * Implements dependency injection pattern for better testability
 */
export class VectorStoreImpl implements IVectorStore {
  private index: LocalIndex;
  private embeddingsManager: EmbeddingsManager;
  private toolsMap: Map<string, ToolWithMetadata> = new Map();
  private initialized: boolean = false;
  private indexPath: string;

  constructor(embeddingsManager: EmbeddingsManager, indexPath: string = '.vector-index') {
    // Resolve path relative to the build directory (one level up to project root)
    // This ensures the index is created in the project directory regardless of cwd
    this.indexPath = path.resolve(__dirname, '..', '..', '..', indexPath);
    this.index = new LocalIndex(this.indexPath);
    this.embeddingsManager = embeddingsManager;
  }

  /**
   * Initialize the vector store
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize embeddings manager
    await this.embeddingsManager.initialize();
    const createIndexConfig: CreateIndexConfig = {version: 1, deleteIfExists: true}
    // Create indexing
    await this.index.createIndex(createIndexConfig);
    
    console.error('✓ Created new vector index');

    this.initialized = true;
  }

  /**
   * Index all tools from registered servers
   */
  async indexTools(servers: Map<string, ServerInfo>): Promise<void> {
    if (!this.initialized) {
      throw new Error('VectorStore not initialized. Call initialize() first.');
    }

    console.error('Indexing tools...');
    let indexed = 0;

    for (const [serverName, serverInfo] of servers) {
      for (const tool of serverInfo.tools) {
        // Use description or name as fallback
        const description = tool.description || tool.name;
        
        // Generate embedding
        const embedding = await this.embeddingsManager.embed(description);

        // Create unique ID
        const id = `${serverName}/${tool.name}`;

        // Store metadata
        this.toolsMap.set(id, {
          serverName,
          toolName: tool.name,
          description,
          tool,
        });

        // Add to vector index
        await this.index.upsertItem({
          id,
          vector: embedding,
          metadata: {
            serverName,
            toolName: tool.name,
            description,
          },
        });

        indexed++;
      }
    }

    console.error(`✓ Indexed ${indexed} tools`);

  }

  /**
   * Search for tools using semantic similarity
   */
  async search(query: string, topK: number = 5): Promise<SearchResult[]> {
    if (!this.initialized) {
      throw new Error('VectorStore not initialized. Call initialize() first.');
    }

    // Generate query embedding
    const queryEmbedding = await this.embeddingsManager.embed(query);

    // Search vector index
    const results = await this.index.queryItems(queryEmbedding, topK);

    // Map results to SearchResult format
    return results.map((result) => {
      const toolMeta = this.toolsMap.get(result.item.id);
      if (!toolMeta) {
        throw new Error(`Tool metadata not found for ${result.item.id}`);
      }

      return {
        serverName: toolMeta.serverName,
        toolName: toolMeta.toolName,
        description: toolMeta.description,
        score: result.score,
        tool: toolMeta.tool,
      };
    });
  }

  /**
   * Re-index a specific server's tools
   */
  async reindexServer(serverName: string, serverInfo: ServerInfo): Promise<void> {
    // Remove old entries for this server
    for (const [id, meta] of this.toolsMap) {
      if (meta.serverName === serverName) {
        await this.index.deleteItem(id);
        this.toolsMap.delete(id);
      }
    }

    // Index new tools
    for (const tool of serverInfo.tools) {
      const description = tool.description || tool.name;
      const embedding = await this.embeddingsManager.embed(description);
      const id = `${serverName}/${tool.name}`;

      this.toolsMap.set(id, {
        serverName,
        toolName: tool.name,
        description,
        tool,
      });

      await this.index.upsertItem({
        id,
        vector: embedding,
        metadata: { serverName, toolName: tool.name, description },
      });
    }

  }

  /**
   * Get statistics about the vector store
   */
  getStats(): { totalTools: number;  } {
    return {
      totalTools: this.toolsMap.size,
    };
  }
}
