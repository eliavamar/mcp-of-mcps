import { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Tool definitions for the MCP of MCPs meta-server
 * 
 * This meta-server aggregates multiple MCP servers and provides three core capabilities:
 * 1. Discovery - Find what servers and tools are available
 * 2. Introspection - Get detailed information about specific tools
 * 3. Execution - Run custom JavaScript code that composes multiple tool calls
 */

export const toolDefinitions: Tool[] = [
  {
    name: "get_mcps_servers_overview",
    description: `Discover all connected MCP servers and their available tools in this aggregated environment.

      This is a DISCOVERY tool that shows you the complete landscape of connected servers and their capabilities. Use this first to understand what's available before diving into specific tools.

      Returns:
      - A hierarchical list of all connected servers
      - Server instructions (if provided by the server)
      - All tools in format 'serverName/toolName' (one per line)

      Use cases:
      - Initial exploration: "What servers are connected and what can they do?"
      - Finding tools: "Which server provides weather functionality?"
      - Complex multi-tool scenarios: "I need to download a file from Google Drive and send it via Slack"
      - Cross-server automation: "I want to fetch data from a database, generate a chart, and email it"
      - Integration discovery: "I need to monitor weather conditions and update a spreadsheet when temperature drops"

      Example output:
      # google_drive mcp server instructions: Access and manage Google Drive files
      google_drive/download_file
      google_drive/list_files
      google_drive/upload_file
      # slack mcp server instructions: Send messages and manage Slack workspaces
      slack/send_message
      slack/create_channel
      slack/upload_file
      # database mcp server instructions: Query and manage databases
      database/execute_query
      database/list_tables`,
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
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
      - Multi-tool workflow planning: "I need to download 'mcp_best_practices.pdf' from Google Drive and send it in Slack to #engineering channel - what parameters do google_drive/download_file and slack/send_message require?"
      - Complex automation preparation: "I want to query a database for sales data, generate a report, and email it to my team - let me check the schemas for database/execute_query, reports/generate_pdf, and email/send_with_attachment"
      - Integration blueprint: "I need to fetch weather data and update a Google Sheet when temperature exceeds 90°F - what are the exact parameters for weather/get_current and google_sheets/update_cell?"

      Example simple query:
      Input: ["weather/get_forecast"]
      Output: 
      [{
        "name": "get_forecast",
        "description": "Get weather forecast for coordinates",
        "inputSchema": { "properties": { "latitude": {...}, "longitude": {...} } },
        "exampleUsage": "const get_forecast = require('./weather/get_forecast.cjs');\\nmodule.exports = get_forecast({ latitude: 40.7128, longitude: -74.0060 });"
      }]

      Example multi-tool query:
      Input: ["google_drive/download_file", "slack/send_message"]
      Output: 
      [
        {
          "name": "download_file",
          "description": "Download a file from Google Drive",
          "inputSchema": { "properties": { "fileId": {...}, "destinationPath": {...} } },
          "exampleUsage": "const download_file = require('./google_drive/download_file.cjs');\\nmodule.exports = download_file({ fileId: 'abc123', destinationPath: './file.pdf' });"
        },
        {
          "name": "send_message",
          "description": "Send a message to a Slack channel",
          "inputSchema": { "properties": { "channel": {...}, "text": {...}, "fileData": {...} } },
          "exampleUsage": "const send_message = require('./slack/send_message.cjs');\\nmodule.exports = send_message({ channel: '#engineering', text: 'Check this out!', fileData: '...' });"
        }
      ]`,
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
      })();

      3️⃣ Parallel tool calls for efficiency:
      module.exports = (async () => {
        const get_forecast = require('./weather/get_forecast.cjs');
        const get_news = require('./news/get_headlines.cjs');
        
        const [weather, news] = await Promise.all([
          get_forecast({ latitude: 40.7128, longitude: -74.0060 }),
          get_news({ category: 'technology' })
        ]);
        
        return { weather, news };
      })();

      4️⃣ Processing and transforming results:
      module.exports = (async () => {
        const get_data = require('./api/get_data.cjs');
        const response = await get_data({ id: '123' });
        
        // Extract and process the text content
        const text = response.content[0].text;
        const processed = text.toUpperCase().split(',');
        
        return { original: text, processed };
      })();

      5️⃣ Conditional logic and error handling:
      module.exports = (async () => {
        const check_status = require('./api/check_status.cjs');
        const fetch_data = require('./api/fetch_data.cjs');
        
        try {
          const status = await check_status({ service: 'api' });
          if (status.content[0].text === 'online') {
            return await fetch_data({ query: 'latest' });
          } else {
            return { error: 'Service offline' };
          }
        } catch (error) {
          return { error: error.message };
        }
      })();

      Notes:
      - All tool calls return Promises - handle them properly
      - Use './' prefix for require paths (e.g., './weather/get_forecast.cjs')
      - ALWAYS use async IIFE when using 'await': module.exports = (async () => { ... })();
      - Return your result from the async function
      - Tool responses follow MCP format with 'content' array`,
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
