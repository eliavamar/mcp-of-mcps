import { McpServerConnectionConfig } from "../domain/types.js";
import { ConnectionManager } from "../infrastructure/connection/ConnectionManager.js";
import { VectorStoreImpl } from "../infrastructure/storage/VectorStoreImpl.js";
import { SandboxManagerImpl } from "../infrastructure/sandbox/SandboxManagerImpl.js";
import { ServerRegistryService } from "../application/services/ServerRegistryService.js";
import { ToolsParserService } from "../application/services/ToolsParserService.js";
import { ToolCallHandler } from "../application/handlers/ToolCallHandler.js";
import { McpOfMcps } from "../presentation/McpOfMcps.js";
import { EmbeddingsManager } from "../infrastructure/storage/EmbeddingsManager.js";

/**
 * Factory for creating and wiring up application components
 * Uses manual dependency injection without decorators
 */
export class AppFactory {
  /**
   * Create a fully configured MCP server instance
   * @param config - Array of MCP server configurations
   * @returns Configured McpOfMcps instance
   */
  static createMcpServer(config: McpServerConnectionConfig[]): McpOfMcps {
    // Create infrastructure layer components
    const connectionManager = new ConnectionManager();
    const embeddingsManager = new EmbeddingsManager();
    const vectorStore = new VectorStoreImpl(embeddingsManager, '.vector-index');
    const sandboxManager = new SandboxManagerImpl('.sandbox');
    
    // Create application layer components
    const serverRegistry = new ServerRegistryService(connectionManager);
    const toolsParser = new ToolsParserService();
    const toolCallHandler = new ToolCallHandler(
      serverRegistry,
      toolsParser,
      sandboxManager,
      vectorStore
    );
    
    // Create presentation layer
    return new McpOfMcps(
      config,
      toolCallHandler,
      serverRegistry,
      vectorStore,
      sandboxManager,
      toolsParser
    );
  }
}
