import { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Additional answer text for servers overview
 */
export const SERVERS_OVERVIEW_ADDITIONAL_ANS = `
Note: If you want to use any tools from the list first find out how to use in using the "get_tools_overview" tool.
`;

/**
 * Additional answer text for tools overview
 */
export const TOOLS_OVERVIEW_ADDITIONAL_ANS = `
Note:\n - If you want to excute tool use the "run_functions_code"\n - Try to create code that use all the tools that need, specily if for example tool_a input go to tool_b.
`;

/**
 * Tool definitions for the MCP of MCPs meta-server
 * 
 * This meta-server aggregates multiple MCP servers and provides three core capabilities:
 * 1. Discovery - Find what servers and tools are available
 * 2. Introspection - Get detailed information about specific tools
 * 3. Execution - Run custom JavaScript code that composes multiple tool calls
 */
export const TOOL_DEFINITIONS: Tool[] = [
  {
    name: "semantic_search_tools",
    description: `Semantically search for tools based on natural language descriptions. Returns the most relevant tools ranked by similarity score.

      This is a SEMANTIC DISCOVERY tool that helps you find tools when you know what you want to do but don't know which tools to use.

      Input:
      - query: Natural language description of what you're looking for
      - limit: Maximum number of results to return (default: 5)

      Returns (as JSON array):
      - serverName: The MCP server providing this tool
      - toolName: The name of the tool
      - description: Tool's description
      - similarityScore: Relevance score (0.0 to 1.0, higher is more relevant)
      - fullPath: Complete tool path as 'serverName/toolName'

      Use cases:
      - Finding relevant tools: "tools for sending emails"
      - Capability discovery: "what can I use for file management"
      - Task-based search: "tools to query databases"
      - Intent matching: "I need to send notifications"
      - Workflow planning: "tools for processing images"

      After finding relevant tools with this search, use 'get_tools_overview' to get their detailed schemas and usage examples.`,
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural language description of what you're looking for (e.g., 'tools for sending emails', 'file management tools', 'database operations')"
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 5)",
          default: 5
        }
      },
      required: ["query"]
    }
  },
  {
    name: "get_tools_overview",
    description: `Get comprehensive documentation for specific tools including schemas, parameters, and usage examples.

      This is an INTROSPECTION tool that provides everything you need to understand HOW to use specific tools. After discovering tools with 'get_mcps_servers_overview', use this to get their full specifications.

      Input:
      - toolPaths: Array of tool paths in 'serverName/toolName' format

      Returns (as JSON):
      - Tool name and description
      - Complete input schema with parameter types and descriptions
      - Required vs optional parameters
      - Example usage code showing how to call the tool

      Use cases:
      - Understanding parameters: "What arguments does this tool accept?"
      - Learning usage: "How do I call this tool correctly?"
      - Schema validation: "Is this parameter required or optional?"
      - Multi-tool workflow planning: "I need to download 'mcp_best_practices.pdf' from Google Drive and send it in Slack to #engineering channel - what parameters do google_drive/download_file and slack/send_message require?"`,
    inputSchema: {
      type: "object",
      properties: {
        toolPaths: {
          type: "array",
          description: "Array of tool paths in format 'serverName/toolName' (e.g., ['weather/get_forecast', 'database/execute_query'])",
          items: {
            type: "string",
          },
        },
      },
      required: ["toolPaths"],
    },
  },
  {
    name: "run_functions_code",
    description: `Execute custom JavaScript code with access to ALL connected MCP server tools.

      This is a COMPOSITION & EXECUTION tool that lets you orchestrate complex workflows by:
      - Calling multiple tools in sequence or parallel
      - Processing and transforming tool results
      - Implementing conditional logic and error handling
      - Combining data from different servers

      Features:
      - Full Node.js environment
      - Access to all tools via require('./serverName/toolName.cjs')
      - Promise-based async execution

      IMPORTANT: When using 'await', wrap your code in an async IIFE pattern:
      module.exports = (async () => {
        // your async code here
        return result;
      })();

      Common Patterns:

      1️⃣ Single tool call (returns Promise directly):
      const get_forecast = require('./weather/get_forecast.cjs');
      module.exports = get_forecast({ latitude: 40.7128, longitude: -74.0060 });

      2️⃣ Sequential tool calls with data flow:
      module.exports = (async () => {
        const get_location = require('./geo/get_location.cjs');
        const get_forecast = require('./weather/get_forecast.cjs');
        
        const location = await get_location({ city: 'New York' });
        const weather = await get_forecast({ 
          latitude: location.lat, 
          longitude: location.lon 
        });
        
        return { location, weather };
      })();`,
    inputSchema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "JavaScript code to execute. Must export result via 'module.exports'. Use async IIFE pattern for await: module.exports = (async () => { return result; })();",
        },
      },
      required: ["code"],
    },
  },
];

/**
 * Generate dynamic tool definition for servers overview
 * @param serversOverview - Overview text of all servers and tools
 * @returns Tool definition with embedded servers overview
 */
export function getServersOverviewToolDefinition(serversOverview: string): Tool {
  return {
    name: "get_mcps_servers_overview",
    description: `
      Discover all connected MCP servers and their available tools in this aggregated environment.
      This is a DISCOVERY tool that shows you the complete landscape of connected servers and their capabilities. Use this first to understand what's available before diving into specific tools.

      The following description include:
      - A hierarchical list of all connected servers
      - Server instructions (if provided by the server)
      - All tools in format 'serverName/toolName' (one per line)
      
      ${serversOverview}
      `,
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    }
  };
}
