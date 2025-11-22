import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ServerInfo } from "../../domain/types.js";
import { ISandboxManager } from "../../interfaces/ISandboxManager.js";
import { NodeVM } from "vm2";
import { convertOutputToSchema } from "../../utils.js";
import { ServersToolDatabaseImpl } from "../database/serversToolDatabaseImpl.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * SandboxManagerImpl manages code execution in an isolated sandbox
 * Implements dependency injection pattern for better testability
 */
export class SandboxManagerImpl implements ISandboxManager {
  private sandboxPath: string;
  private vm: NodeVM;
  private serversInfo: Map<string, ServerInfo>;
  private toolOutputCache: Map<string, Array<{toolName: string, output: any}>>;

  constructor(sandboxPath?: string) {
    // Calculate project root: go up from build/infrastructure/sandbox to project root
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    
    // Use provided path or default to .sandbox in project root
    if (sandboxPath) {
      this.sandboxPath = path.isAbsolute(sandboxPath) 
        ? sandboxPath 
        : path.resolve(projectRoot, sandboxPath);
    } else {
      this.sandboxPath = path.resolve(projectRoot, '.sandbox');
    }
    
    this.serversInfo = new Map();
    this.toolOutputCache = new Map();
    
    // Create NodeVM with mock module to provide injectedObject
    this.vm = new NodeVM({
      console: 'inherit',
      sandbox: {},
      require: {
        external: true,      // allow external modules (local files)
        root: this.sandboxPath,     // set root directory for requires to sandbox
        context: 'sandbox',  // Load modules in sandbox context to make mocks work
        mock: {
          'serversInfo': this.serversInfo,  // Mock module that provides the data (read-only)
          'toolOutputCache': this.toolOutputCache,  // Mock module for cache (mutable)
        },
      },
    });
    
    this.createSandboxFolder();
  }

  /**
   * Initialize the sandbox with server information
   * @param servers - Map of server information
   */
  initialize(servers: Map<string, ServerInfo>): void {
    // Clear existing entries and populate with new data
    this.clearAndSetServiceInfoCache(servers);
    this.clearAndSetToolOutCache();

    
    // Freeze the serversInfo for the VM (read-only)
    this.vm.freeze(this.serversInfo, 'serversInfo');
    
    // Note: toolOutputCache is NOT frozen, so it remains mutable
    
    // Create sandbox structure
    this.createSandboxStructure(servers);
  }

  /**
   * Execute code in the sandbox
   * @param code - JavaScript code to execute
   * @returns Promise resolving to the execution result
   * @throws Error if execution fails
   */
  async execute(code: string): Promise<any> {
    try {
      // Use a virtual filename within the sandbox path for proper require resolution
      const filename = path.join(this.sandboxPath, 'exec.js');
      const result = this.vm.run(code, filename);
      
      // If the result is a Promise, wait for it to resolve
      let finalResult;
      if (result && typeof result.then === 'function') {
        finalResult = await result;
      } else {
        finalResult = result;
      }

      // Save tool output schemas to database using singleton instance
      await this.updateOutputSchema();
      // update db with output cache
      this.clearAndSetToolOutCache();
      
      return finalResult;
    } catch (error) {
      console.error('✗ Error executing code in sandbox:', error);
      throw error;
    }
  }

  private async updateOutputSchema() {
    const toolDatabase = ServersToolDatabaseImpl.getInstance();

    for (const [serverName, outputs] of this.toolOutputCache) {
      for (const { toolName, output } of outputs) {
        try {
          // Convert output to schema
          const outputSchema = convertOutputToSchema(output);

          if (outputSchema) {
            // Check if tool exists in database
            const existingTool = await toolDatabase.getTool(serverName, toolName);

            if (existingTool) {
            } else {
              throw new Error(`Tool ${toolName} not found in database for server ${serverName}`);
            }
            
            if (!existingTool.originalOutputSchema) {
              // Update existing tool's output schema
              await toolDatabase.updateTool(
                serverName,
                toolName,
                JSON.stringify(outputSchema),
                false // originalOutputSchema = false since we generated it from output
              );
              // Update the tool's output schema in ServerInfo
              const serverInfo = this.serversInfo.get(serverName);
              if (serverInfo) {
                const tool = serverInfo.tools.find(t => t.name === toolName);
                if (tool) {
                  tool.outputSchema = outputSchema;
                  console.error(`✓ Updated output schema for ${serverName}/${toolName} in ServerInfo`);
                }
              }
            }
          }
        } catch (error) {
          console.error(`✗ Failed to save output schema for ${serverName}/${toolName}:`, error);
        }
      }
    }
  }

  /**
   * Create empty sandbox folder
   */
  private createSandboxFolder(): void {
    try {
      if (fs.existsSync(this.sandboxPath)) {
        fs.rmSync(this.sandboxPath, { recursive: true, force: true });
      }
      fs.mkdirSync(this.sandboxPath, { recursive: true });
      console.error(`✓ Created empty sandbox folder at: ${this.sandboxPath}`);
    } catch (error) {
      console.error(`✗ Failed to create sandbox folder:`, error);
      throw error;
    }
  }

  /**
   * Create folder structure for all servers and their tools
   */
  private createSandboxStructure(serversInfo: Map<string, ServerInfo>): void {
    for (const [serverName, serverInfo] of serversInfo) {
      try {
        const serverFolderPath = path.join(this.sandboxPath, serverName);
        fs.mkdirSync(serverFolderPath, { recursive: true });

        // Get tools from server info
        const tools = serverInfo.tools;

        // Create a file for each tool
        for (const tool of tools) {
          const toolFilePath = path.join(serverFolderPath, `${tool.title}.cjs`);
          const toolFileContent = this.generateToolFile(serverName, tool);
          fs.writeFileSync(toolFilePath, toolFileContent, 'utf-8');
        }

        console.error(`✓ Created folder structure for ${serverName} with ${tools.length} tools`);
      } catch (error) {
        console.error(`✗ Failed to create folder structure for ${serverName}:`, error);
      }
    }
  }

  /**
   * Generate tool file content for a given server and tool
   */
  private generateToolFile(serverName: string, tool: Tool): string {

    const toolFileContent = `
      const serversInfo = require('serversInfo');
      const toolOutputCache = require('toolOutputCache');
      
      async function ${tool.title}(args) {

          const serverInfo = serversInfo.get("${serverName}");
          if (!serverInfo) {
            throw new Error(\`Server ${serverName} not exist\`);
          }
          if(!serverInfo.client) {
            throw new Error(\`Client for server ${serverName} not connected\`);
          }
          const client = serverInfo.client;
          const response = await client.callTool({
            name: "${tool.name}",
            arguments: args,
          });
          // Save output to cache
          const serverCache = toolOutputCache.get("${serverName}");
          if (serverCache) {
            serverCache.push({
              toolName: "${tool.name}",
              output: response
            });
          }
          
          return response;
      }

      module.exports = ${tool.title};
  `;

    return toolFileContent;
  }

  /**
   * Get all cached outputs for a specific server
   * @param serverName - Name of the server
   * @returns Array of tool outputs or undefined if server not found
   */
  getServerOutputs(serverName: string): Array<{toolName: string, output: any}> | undefined {
    return this.toolOutputCache.get(serverName);
  }

  /**
   * Get the entire cache
   * @returns The complete tool output cache
   */
  getAllOutputs(): Map<string, Array<{toolName: string, output: any}>> {
    return this.toolOutputCache;
  }

  /**
   * Clear the cache for a specific server
   * @param serverName - Name of the server
   */
  clearServerCache(serverName: string): void {
    const serverCache = this.toolOutputCache.get(serverName);
    if (serverCache) {
      serverCache.length = 0;
    }
  }

  /**
   * Clear the entire cache
   */
  clearAndSetToolOutCache(): void {
    this.toolOutputCache.clear();
    for (const [serverName, serverInfo] of this.serversInfo) {
      this.toolOutputCache.set(serverName, []);
    }
  }
    /**
   * Clear the entire cache
   */
  clearAndSetServiceInfoCache(serversInfo: Map<string, ServerInfo>): void {
    this.serversInfo.clear();
    for (const [serverName, serverInfo] of serversInfo) {
      this.serversInfo.set(serverName, serverInfo);
    }
  }
}
