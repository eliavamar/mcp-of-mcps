import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ServerInfo } from "../../domain/types.js";
import { ISandboxManager } from "../../interfaces/ISandboxManager.js";
import { NodeVM } from "vm2";

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
    
    // Create NodeVM with mock module to provide injectedObject
    this.vm = new NodeVM({
      console: 'inherit',
      sandbox: {},
      require: {
        external: true,      // allow external modules (local files)
        root: this.sandboxPath,     // set root directory for requires to sandbox
        context: 'sandbox',  // Load modules in sandbox context to make mocks work
        mock: {
          'serversInfo': this.serversInfo,  // Mock module that provides the data
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
    this.serversInfo.clear();
    for (const [serverName, serverInfo] of servers) {
      this.serversInfo.set(serverName, serverInfo);
    }
    
    // Freeze the serversInfo for the VM
    this.vm.freeze(this.serversInfo, 'serversInfo');
    
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
      if (result && typeof result.then === 'function') {
        return await result;
      }
      return result;
    } catch (error) {
      console.error('✗ Error executing code in sandbox:', error);
      throw error;
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
          return response;
      }

      module.exports = ${tool.title};
  `;

    return toolFileContent;
  }
}
