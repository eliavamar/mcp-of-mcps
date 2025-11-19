import { ServerInfo } from "../../domain/types.js";
import { IToolsParser } from "../../interfaces/IToolsParser.js";

// Import prompt constants
const SERVERS_OVERVIEW_ADDITIONAL_ANS = `
Note: If you want to use any tools from the list first find out how to use in using the "get_tools_overview" tool.
`;

const TOOLS_OVERVIEW_ADDITIONAL_ANS = `
Note:\n - If you want to excute tool use the "run_functions_code"\n - Try to create code that use all the tools that need, specily if for example tool_a input go to tool_b.
`;

/**
 * ToolsParserService provides utilities to parse and retrieve tools from MCP servers
 * Implements dependency injection pattern for better testability
 */
export class ToolsParserService implements IToolsParser {
  /**
   * Generate a tree overview of all MCP servers and their tools
   * @param servers - Map of server information
   * @returns Formatted string with server overview
   */
  getServersOverview(servers: Map<string, ServerInfo>): string {
    const lines: string[] = [];

    // Iterate through all servers
    for (const [serverName, serverInfo] of servers) {
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
    const servicesOverView = lines.join(`\n`);
    return `${servicesOverView}\n\n${SERVERS_OVERVIEW_ADDITIONAL_ANS}`;
  }

  /**
   * Get detailed overview for specific tools by their paths
   * @param servers - Map of server information
   * @param toolPaths - Array of tool paths in format "serverName/toolName"
   * @returns JSON stringified array of tools with details
   */
  getToolsOverview(servers: Map<string, ServerInfo>, toolPaths: string[]): string {
    const tools = [];

    for (const toolPath of toolPaths) {
      // Parse the path to extract server name and tool name
      const parts = toolPath.split("/");
      
      if (parts.length !== 2) {
        throw new Error(`Error: Invalid tool path format '${toolPath}'. Expected 'serverName/toolName'`);
      }

      const [serverName, toolName] = parts;

      // Look up the server
      const serverInfo = servers.get(serverName);
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
          exampleUsage,
          name: tool.title
        });
      } else {
        console.error(`Error: Tool '${toolName}' not found in server '${serverName}'`);
      }
    }

    return `${JSON.stringify(tools)}\n\n ${TOOLS_OVERVIEW_ADDITIONAL_ANS}`;
  }
}
