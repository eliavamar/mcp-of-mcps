import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ServerInfo } from "./types.js";
import { convertToolName } from "./utils.js";
import { NodeVM } from "vm2";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SandboxManager {
  private sandboxPath: string;
  private vm :NodeVM;
  private serversInfo: Map<string, ServerInfo>;
  constructor(sandboxPath?: string) {
    this.sandboxPath =(!sandboxPath) ? path.join(__dirname, '..', '.sandbox') : sandboxPath;
    this.createSandboxFolder();
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
    
  }

  /**
   * Initialize empty sandbox folder
   */
  createSandboxFolder(): void {
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
   * Generate tool file content for a given server and tool
   */
  private generateToolFile(serverName: string, tool: Tool): string {
    const schema = tool.inputSchema as any;
    const properties = schema?.properties || {};
    const required = schema?.required || [];

    // Generate JSDoc parameters
    let paramDocs = '';
    for (const [paramName, paramSchema] of Object.entries(properties)) {
      const param = paramSchema as any;
      const isRequired = required.includes(paramName);
      const paramType = param.type || 'any';
      const paramDesc = param.description || '';
      paramDocs += ` * @param {${paramType}} ${isRequired ? '' : '['}args.${paramName}${isRequired ? '' : ']'} - ${paramDesc}\n`;
    }

    const toolFileContent = `
      const serversInfo = require('serversInfo');
      async function ${convertToolName(tool.name)}(args) {

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

      module.exports = ${convertToolName(tool.name)};
  `;

    return toolFileContent;
  }

  /**
   * Create folder structure for all servers and their tools
   */
  createSendBox(serversInfo: Map<string, ServerInfo>): void {
    // Clear existing entries and populate with new data
    this.serversInfo.clear();
    for (const [serverName, serverInfo] of serversInfo) {
      this.serversInfo.set(serverName, serverInfo);
    }
    
    // Freeze the serversInfo for the VM
    this.vm.freeze(this.serversInfo, 'serversInfo');
    
    for (const [serverName, serverInfo] of serversInfo) {
      try {
        const serverFolderPath = path.join(this.sandboxPath, serverName);
        fs.mkdirSync(serverFolderPath, { recursive: true });

        // Get tools from server info
        const tools = serverInfo.tools;

        // Create a file for each tool
        for (const tool of tools) {
          const toolFilePath = path.join(serverFolderPath, `${convertToolName(tool.name)}.cjs`);
          const toolFileContent = this.generateToolFile(serverName, tool);
          fs.writeFileSync(toolFilePath, toolFileContent, 'utf-8');
        }

        console.error(`✓ Created folder structure for ${serverName} with ${tools.length} tools`);
      } catch (error) {
        console.error(`✗ Failed to create folder structure for ${serverName}:`, error);
      }
    }
  }
  
  async runCodeInSandbox(code: string): Promise<any> {
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

}
