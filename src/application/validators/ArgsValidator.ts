/**
 * Validation result for tool arguments
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Arguments for get_tools_overview
 */
export interface GetToolsOverviewArgs {
  toolPaths: string[];
}

/**
 * Arguments for semantic_search_tools
 */
export interface SemanticSearchArgs {
  query: string;
  limit?: number;
}

/**
 * Arguments for run_functions_code
 */
export interface RunCodeArgs {
  code: string;
}

/**
 * ArgsValidator provides type-safe validation for tool arguments
 */
export class ArgsValidator {
  /**
   * Validate arguments for get_tools_overview
   */
  static validateGetToolsOverview(
    args: Record<string, unknown> | undefined
  ): ValidationResult<GetToolsOverviewArgs> {
    if (!args) {
      return {
        success: false,
        error: "Arguments are required for get_tools_overview",
      };
    }

    const { toolPaths } = args;

    if (!toolPaths) {
      return {
        success: false,
        error: "toolPaths is required",
      };
    }

    if (!Array.isArray(toolPaths)) {
      return {
        success: false,
        error: "toolPaths must be an array",
      };
    }

    if (!toolPaths.every((path) => typeof path === "string")) {
      return {
        success: false,
        error: "toolPaths must be an array of strings",
      };
    }

    return {
      success: true,
      data: { toolPaths } as GetToolsOverviewArgs,
    };
  }

  /**
   * Validate arguments for semantic_search_tools
   */
  static validateSemanticSearch(
    args: Record<string, unknown> | undefined
  ): ValidationResult<SemanticSearchArgs> {
    if (!args) {
      return {
        success: false,
        error: "Arguments are required for semantic_search_tools",
      };
    }

    const { query, limit } = args;

    if (!query) {
      return {
        success: false,
        error: "query is required",
      };
    }

    if (typeof query !== "string") {
      return {
        success: false,
        error: "query must be a string",
      };
    }

    if (limit !== undefined && typeof limit !== "number") {
      return {
        success: false,
        error: "limit must be a number",
      };
    }

    return {
      success: true,
      data: { query, limit } as SemanticSearchArgs,
    };
  }

  /**
   * Validate arguments for run_functions_code
   */
  static validateRunCode(
    args: Record<string, unknown> | undefined
  ): ValidationResult<RunCodeArgs> {
    if (!args) {
      return {
        success: false,
        error: "Arguments are required for run_functions_code",
      };
    }

    const { code } = args;

    if (!code) {
      return {
        success: false,
        error: "code is required",
      };
    }

    if (typeof code !== "string") {
      return {
        success: false,
        error: "code must be a string",
      };
    }

    return {
      success: true,
      data: { code } as RunCodeArgs,
    };
  }
}
