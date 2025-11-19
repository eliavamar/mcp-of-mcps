import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';

export class EmbeddingsManager {
  private embedder: FeatureExtractionPipeline | undefined;
  private modelName: string = 'Xenova/all-MiniLM-L6-v2';
  private initialized: boolean = false;

  constructor() {}

  /**
   * Initialize the embedding model
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.error('Initializing embedding model...');
    
    // Load embedding model
    this.embedder = await pipeline(
      'feature-extraction',
      this.modelName
    );

    this.initialized = true;
    console.error('✓ Embedding model initialized');
  }

  /**
   * Generate embedding for a text
   */
  async embed(text: string): Promise<number[]> {
    if (!this.initialized || !this.embedder) {
      throw new Error('EmbeddingsManager not initialized. Call initialize() first.');
    }

    // Generate embedding
    const output = await this.embedder(text, {
      pooling: 'mean',
      normalize: true,
    });

    // Convert to array
    const embedding = Array.from(output.data as Float32Array);

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
}
