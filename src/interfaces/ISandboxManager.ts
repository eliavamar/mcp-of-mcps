import { ServerInfo } from "../domain/types.js";

/**
 * Interface for managing code execution sandbox
 */
export interface ISandboxManager {
  /**
   * Initialize the sandbox with server information
   * @param servers - Map of server information
   */
  initialize(servers: Map<string, ServerInfo>): void;

  /**
   * Execute code in the sandbox
   * @param code - JavaScript code to execute
   * @returns Promise resolving to the execution result
   * @throws Error if execution fails
   */
  execute(code: string): Promise<any>;
}
