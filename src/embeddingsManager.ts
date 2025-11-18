import { pipeline, Pipeline } from '@xenova/transformers';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface EmbeddingCache {
  version: string;
  model: string;
  embeddings: Map<string, number[]>;
}

export class EmbeddingsManager {
  private embedder: any = null;
  private modelName: string = 'Xenova/all-MiniLM-L6-v2';
  private cache: Map<string, number[]> = new Map();
  private cacheFilePath: string;
  private initialized: boolean = false;

  constructor(cacheDir: string = '.embeddings-cache') {
    this.cacheFilePath = path.join(cacheDir, 'embeddings.json');
  }

  /**
   * Initialize the embedding model and load cache
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.error('Initializing embedding model...');
    
    // Load embedding model
    this.embedder = await pipeline(
      'feature-extraction',
      this.modelName
    );

    // Load cached embeddings if available
    await this.loadCache();

    this.initialized = true;
    console.error(`✓ Embedding model initialized with ${this.cache.size} cached embeddings`);
  }

  /**
   * Generate embedding for a text
   */
  async embed(text: string): Promise<number[]> {
    if (!this.initialized || !this.embedder) {
      throw new Error('EmbeddingsManager not initialized. Call initialize() first.');
    }

    // Check cache first
    const cached = this.cache.get(text);
    if (cached) {
      return cached;
    }

    // Generate new embedding
    const output = await this.embedder(text, {
      pooling: 'mean',
      normalize: true,
    });

    // Convert to array
    const embedding = Array.from(output.data as Float32Array);

    // Cache the result
    this.cache.set(text, embedding);

    return embedding;
  }

  /**
   * Batch embed multiple texts
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    for (const text of texts) {
      const embedding = await this.embed(text);
      embeddings.push(embedding);
    }

    return embeddings;
  }

  /**
   * Load embeddings cache from disk
   */
  private async loadCache(): Promise<void> {
    try {
      const data = await fs.readFile(this.cacheFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      
      if (parsed.model === this.modelName) {
        this.cache = new Map(Object.entries(parsed.embeddings));
        console.error(`✓ Loaded ${this.cache.size} cached embeddings`);
      } else {
        console.error('Cache model mismatch, starting fresh');
      }
    } catch (error) {
      // Cache file doesn't exist or is invalid, start fresh
      console.error('No cache found, will create new embeddings');
    }
  }

  /**
   * Save embeddings cache to disk
   */
  async saveCache(): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.cacheFilePath);
      await fs.mkdir(dir, { recursive: true });

      const cacheData = {
        version: '1.0',
        model: this.modelName,
        embeddings: Object.fromEntries(this.cache),
      };

      await fs.writeFile(
        this.cacheFilePath,
        JSON.stringify(cacheData, null, 2),
        'utf-8'
      );

      console.error(`✓ Saved ${this.cache.size} embeddings to cache`);
    } catch (error) {
      console.error('Failed to save embeddings cache:', error);
    }
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
