import { IServerRegistry } from "../../interfaces/IServerRegistry.js";
import { IToolsParser } from "../../interfaces/IToolsParser.js";
import { ISandboxManager } from "../../interfaces/ISandboxManager.js";
import { IVectorStore } from "../../interfaces/IVectorStore.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Tool response type matching MCP SDK format
 */
export type ToolResponse = CallToolResult;

/**
 * Arguments for get_tools_overview
 */
interface GetToolsOverviewArgs {
  toolPaths: string[];
}

/**
 * Arguments for semantic_search_tools
 */
interface SemanticSearchArgs {
  query: string;
  limit?: number;
}

/**
 * Arguments for run_functions_code
 */
interface RunCodeArgs {
  code: string;
}

/**
 * ToolCallHandler handles execution of tool calls
 * Implements dependency injection pattern for better testability
 */
export class ToolCallHandler {
  constructor(
    private serverRegistry: IServerRegistry,
    private toolsParser: IToolsParser,
    private sandboxManager: ISandboxManager,
    private vectorStore: IVectorStore
  ) {}

  /**
   * Handle get_mcps_servers_overview tool call
   */
  async handleGetServersOverview(): Promise<ToolResponse> {
    const overview = this.toolsParser.getServersOverview(
      this.serverRegistry.getAllServers()
    );
    return {
      content: [
        {
          type: "text",
          text: overview,
        },
      ],
    };
  }

  /**
   * Handle get_tools_overview tool call
   */
  async handleGetToolsOverview(args: GetToolsOverviewArgs): Promise<ToolResponse> {
    const { toolPaths } = args;
    
    try {
      const toolsJson = this.toolsParser.getToolsOverview(
        this.serverRegistry.getAllServers(),
        toolPaths
      );
      return {
        content: [
          {
            type: "text",
            text: toolsJson,
          },
        ],
      };
    } catch (error) {
      return this.formatError(error as Error);
    }
  }

  /**
   * Handle semantic_search_tools tool call
   */
  async handleSemanticSearch(args: SemanticSearchArgs): Promise<ToolResponse> {
    const { query, limit = 5 } = args;
    
    if (typeof query !== "string") {
      return {
        content: [
          {
            type: "text",
            text: "Error: query must be a string",
          },
        ],
      };
    }

    try {
      const results = await this.vectorStore.search(query, limit);
      
      const formattedResults = results.map(r => ({
        serverName: r.serverName,
        toolName: r.toolName,
        description: r.description,
        similarityScore: r.score.toFixed(3),
        fullPath: `${r.serverName}/${r.toolName}`
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formattedResults, null, 2),
          },
        ],
      };
    } catch (error) {
      return this.formatError(error as Error);
    }
  }

  /**
   * Handle run_functions_code tool call
   */
  async handleRunCode(args: RunCodeArgs): Promise<ToolResponse> {
    const { code } = args;
    
    if (typeof code !== "string") {
      return {
        content: [
          {
            type: "text",
            text: "Error: code must be a string",
          },
        ],
      };
    }

    try {
      const result = await this.sandboxManager.execute(code);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return this.formatError(error as Error);
    }
  }

  /**
   * Format error response
   */
  private formatError(error: Error): ToolResponse {
    const errorMessage = error.message || String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
    };
  }
}
