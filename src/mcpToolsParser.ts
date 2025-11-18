import { SERVERS_OVERVIEW_ADDITIONAL_ANS, TOOLS_OVERVIEW_ADDITIONAL_ANS } from "./prompts.js";
import { ServerInfo } from "./types.js";

/**
 * MCPToolsParser provides utilities to parse and retrieve tools from MCP servers
 */
export class MCPToolsParser {
  constructor() {
  }

  /**
   * Generate a tree overview of all MCP servers and their tools
   * @returns String with format: serverName/toolName (one per line)
   */
  getServersOverview(serversInfo: Map<string, ServerInfo>): string {
    const lines: string[] = [];

    // Iterate through all servers
    for (const [serverName, serverInfo] of serversInfo) {
      const serverInstructions = serverInfo.client.getInstructions();
      if (serverInstructions) {
        lines.push(`# ${serverName} mcp server instructions: ${serverInstructions}`);
      }
      // For each tool in the server, create a path line
      for (const tool of serverInfo.tools) {
        lines.push(`${serverName}/${tool.title}`);
      }
    }

    // Sort for consistent output
    lines.sort();
    const servicesOverView = lines.join(`\n`)
    return `${servicesOverView}\n\n${SERVERS_OVERVIEW_ADDITIONAL_ANS}`;
  }

  /**
   * Get detailed overview for specific tools by their paths and return as JSON string
   * @param toolPaths - Array of tool paths in format: "serverName/toolName"
   * @returns JSON stringified array of tools with details
   */
  getToolsOverview(serversInfo: Map<string, ServerInfo>, toolPaths: string[]): string {
    const tools: any[] = [];

    for (const toolPath of toolPaths) {
      // Parse the path to extract server name and tool name
      const parts = toolPath.split("/");
      
      if (parts.length !== 2) {
        throw new Error(`Error: Invalid tool path format '${toolPath}'. Expected 'serverName/toolName'`);
      }

      const [serverName, toolName] = parts;

      // Look up the server
      const serverInfo = serversInfo.get(serverName);
      if (!serverInfo) {
        throw new Error(`Error: Server '${serverName}' not found`);
      }
      // Find the tool
      const tool = serverInfo.tools.find((t) => t.title === toolName);
      if (tool) {
        // Create example usage for this specific tool
        const exampleUsage = `const ${tool.title} = require('./${serverName}/${tool.title}.cjs');
module.exports = ${tool.title}({ /* your parameters here */ });`;
        
        // Add the tool with example usage property
        tools.push({
          ...tool,
          exampleUsage
        });
      } else {
        console.error(`Error: Tool '${toolName}' not found in server '${serverName}'`);
      }
    }

    return `${JSON.stringify(tools)}\n\n ${TOOLS_OVERVIEW_ADDITIONAL_ANS}`;
  }
}
