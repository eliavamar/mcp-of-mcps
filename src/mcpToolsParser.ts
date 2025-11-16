import { ServerInfo } from "./types.js";
import { convertToolName } from "./utils.js";

/**
 * MCPToolsParser provides utilities to parse and retrieve tools from MCP servers
 */
export class MCPToolsParser {
  private serversInfo: Map<string, ServerInfo>;

  /**
   * Constructor
   * @param serversInfo - Map of server information from ServersRegistry
   */
  constructor(serversInfo: Map<string, ServerInfo>) {
    this.serversInfo = serversInfo;
  }

  /**
   * Generate a tree overview of all MCP servers and their tools
   * @returns String with format: serverName/toolName (one per line)
   */
  getServersOverview(): string {
    const lines: string[] = [];

    // Iterate through all servers
    for (const [serverName, serverInfo] of this.serversInfo) {
      const serverInstructions = serverInfo.client.getInstructions();
      if (serverInstructions) {
        lines.push(`# ${serverName} mcp server nstructions: ${serverInstructions}`);
      }
      // For each tool in the server, create a path line
      for (const tool of serverInfo.tools) {
        lines.push(`${serverName}/${tool.name}`);
      }
    }

    // Sort for consistent output
    lines.sort();

    return lines.join("\n");
  }

  /**
   * Get detailed overview for specific tools by their paths and return as JSON string
   * @param toolPaths - Array of tool paths in format: "serverName/toolName"
   * @returns JSON stringified array of tools with details
   */
  getToolsOverview(toolPaths: string[]): string {
    const tools: any[] = [];

    for (const toolPath of toolPaths) {
      // Parse the path to extract server name and tool name
      const parts = toolPath.split("/");
      
      if (parts.length !== 2) {
        throw new Error(`Error: Invalid tool path format '${toolPath}'. Expected 'serverName/toolName'`);
      }

      const [serverName, toolName] = parts;

      // Look up the server
      const serverInfo = this.serversInfo.get(serverName);
      if (!serverInfo) {
        throw new Error(`Error: Server '${serverName}' not found`);
      }

      // Find the tool
      const tool = serverInfo.tools.find((t) => t.name === toolName);
      if (tool) {
        // Create example usage for this specific tool
        const exampleUsage = `const ${convertToolName(toolName)} = require('./${serverName}/${convertToolName(toolName)}.cjs');
module.exports = ${convertToolName(toolName)}({ /* your parameters here */ });`;
        
        // Add the tool with example usage property
        tools.push({
          ...tool,
          exampleUsage
        });
      } else {
        console.error(`Error: Tool '${toolName}' not found in server '${serverName}'`);
      }
    }

    return JSON.stringify(tools);
  }
}
