import { LocalIndex } from 'vectra';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ServerInfo } from './types.js';
import { EmbeddingsManager } from './embeddingsManager.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ToolWithMetadata {
  serverName: string;
  toolName: string;
  description: string;
  tool: Tool;
}

export interface SearchResult {
  serverName: string;
  toolName: string;
  description: string;
  score: number;
  tool: Tool;
}

export class VectorStore {
  private index: LocalIndex;
  private embeddingsManager: EmbeddingsManager;
  private toolsMap: Map<string, ToolWithMetadata> = new Map();
  private initialized: boolean = false;
  private indexPath: string;

  constructor(indexPath: string = '.vector-index') {
    // Resolve path relative to the build directory (one level up to project root)
    // This ensures the index is created in the project directory regardless of cwd
    this.indexPath = path.resolve(__dirname, '..', indexPath);
    this.index = new LocalIndex(this.indexPath);
    this.embeddingsManager = new EmbeddingsManager();
  }

  /**
   * Initialize the vector store
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize embeddings manager
    await this.embeddingsManager.initialize();

    // Ensure the index directory exists before doing anything
    await fs.mkdir(this.indexPath, { recursive: true });

    // Check if index.json exists in the directory
    let indexExists = false;
    try {
      await fs.access(`${this.indexPath}/index.json`);
      indexExists = true;
    } catch {
      // index.json doesn't exist
      indexExists = false;
    }

    // Create or load index
    if (!indexExists) {
      await this.index.createIndex();
      console.error('✓ Created new vector index');
    } else {
      // Index exists, vectra will load it automatically
      console.error('✓ Loaded existing vector index');
    }

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

    // Save embeddings cache
    await this.embeddingsManager.saveCache();
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
    const results = await this.index.queryItems(queryEmbedding, query, topK);

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

    await this.embeddingsManager.saveCache();
  }

  /**
   * Get statistics about the vector store
   */
  getStats(): { totalTools: number; cachedEmbeddings: number } {
    return {
      totalTools: this.toolsMap.size,
      cachedEmbeddings: this.embeddingsManager.getCacheSize(),
    };
  }
}
