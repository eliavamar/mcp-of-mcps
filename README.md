# MCP of MCPs

A meta-server that aggregates multiple MCP servers and enables efficient code execution for AI agents. Reduces token usage, improving speed and reliability.

**New:** Includes persistent database that automatically stores and preserves tool output schemas across sessions, ensuring consistent tool behavior even when mcps servers don't provide complete metadata.

## The Problem

When AI agents connect to multiple MCP servers, they face three critical issues:

### 1. 🔥 Burns Tokens
Every tool definition and intermediate result consumes valuable context window space. With hundreds of tools across multiple servers, agents can waste 150,000+ tokens on a single workflow.

### 2. ⏱️ Slows Everything Down  
The model must process and reason about all tool definitions upfront, even for tools it won't use. This adds significant latency before the agent can even start working.

### 3. 🤯 Increases Hallucinations
When models see too much irrelevant information, they're more likely to get confused and make mistakes. Loading all tools upfront reduces accuracy.

## The Solution

MCP of MCPs is a meta-server that provides four powerful tools for efficient agent orchestration:

### Tool 1: `semantic_search_tools`
**Semantic Discovery Tool** - Search tools by describing the task you want to accomplish. Instead of browsing all of tool names—or when tool names don't clearly indicate what they do—just describe your intent in plain English (e.g., "send notifications", "query database", "process images") and get back only the most relevant tools instantly. This provides a fast and lightweight approach to investigate what tools are available across all connected servers without loading any full tool definitions.

```javascript
// Search by task/intent, not by tool names:
// Input: { query: "send notifications to a channel", limit: 5 }
// Returns only relevant matches (ranked by similarity):
// [
//   {
//     serverName: "slack",
//     toolName: "post_message",
//     description: "Post a message to a Slack channel",
//     similarityScore: 0.94,
//     fullPath: "slack/post_message"
//   },
// ....
//   // Only 5 most relevant tools returned - fast and lightweight!
// ]
```

**Perfect for quick investigation:**
- Describe what you need to do, not what tool you need
- Get instant results without loading full schemas
- Discover capabilities across all servers in milliseconds
- No token overhead - just lightweight tool names and descriptions

### Tool 2: `get_mcps_servers_overview`
**Discovery Tool** - This tool returns only tool names without full schemas, giving agents a lightweight overview in seconds instead of loading hundreds of detailed definitions upfront. By showing just what's available without overwhelming details, it prevents confusion and hallucinations while eliminating loading delays.

```javascript
// Returns:
// google_drive/download_file
// google_drive/upload_file
// slack/send_message
// database/execute_query
// ...
```


### Tool 3: `get_tools_overview`
**Introspection Tool** - Load only the tools you actually need instead of all 30+ tools, saving thousands of tokens through selective loading. This on-demand approach provides faster responses and focused context that reduces confusion and improves accuracy.


```javascript
// Input: ["google_drive/download_file", "slack/send_message"]
// Returns: Full tool definitions with:
// - Parameter schemas
// - Required vs optional fields
// - Example usage code
```


### Tool 4: `run_functions_code`
**Execution Tool** - Data flows directly between tools without round-trips through the model, so a 2MB file transfer uses ~100 tokens instead of 50,000+. The model only sees clean final results instead of noisy intermediate data, executing complex workflows in one shot without processing delays.

```javascript
// Write code that:
// - Calls multiple tools in sequence or parallel
// - Processes and transforms data
// - Implements complex logic and error handling
// - Returns only final results to the model
```

## How The Full Flow Solves All Problems

When you need to accomplish a task, start by using `get_mcps_servers_overview` to get a lightweight list of all available tool names across servers—this gives you a quick scan of what's available without loading any schemas. If you can't find the tools you need for your task or if tool names aren't clear, use `semantic_search_tools` to search by describing your intent in plain English (e.g., "send notifications to a channel"), which uses AI-powered semantic understanding to instantly return only the most relevant tools ranked by similarity. Once you've identified the specific tools you need, use `get_tools_overview` to load only those tool definitions with their full schemas and parameters—saving thousands of tokens by avoiding irrelevant tools and giving the model focused context. Finally, use `run_functions_code` to execute your workflow where data flows directly between tools in memory, keeping intermediate results as native objects rather than serializing them into tokens, with only the final result returned to the model. This pattern dramatically cuts token usage, speeds up execution by avoiding unnecessary model processing, and eliminates hallucinations by showing only relevant information at each step.

### Real-World Example

**Traditional Approach:**
```
TOOL CALL: gdrive.getDocument(documentId: "abc123")
  → returns full transcript text (loads into context: 50,000 tokens)
  
TOOL CALL: salesforce.updateRecord(...)
  → model writes entire transcript again (doubles the tokens: +50,000 tokens)
```

**Total: 100,000+ tokens processed, slow response time**

**With MCP of MCPs:**
```javascript
const transcript = (await gdrive.getDocument({ documentId: 'abc123' })).content;
await salesforce.updateRecord({
  objectType: 'SalesMeeting',
  data: { Notes: transcript }
});
```

The code executes in one operation. Data flows directly between tools. Only the final result returns to the model.

**Total: 2,000 tokens processed (98.7% reduction) ⚡**

## Key Benefits

✅ **Faster Response Time** - No need to load all tools upfront  
✅ **Reduced Hallucinations** - Model sees only relevant information  
✅ **Progressive Disclosure** - Load tools on-demand as needed  
✅ **Code Composition** - Orchestrate complex workflows with familiar JavaScript  
✅ **Persistent Tool Metadata** - Automatically preserves tool output schemas across sessions  

## Setup

### Prerequisites

- Node.js 
- npm or yarn
- Configured MCP servers you want to aggregate


### Add to Cline

Add this to your Cline MCP settings file:

**Option 1: Using inline configuration**
```json
{
  "mcpServers": {
    "mcp-of-mcps": {
      "autoApprove": [],
      "disabled": false,
      "timeout": 60,
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@dbestai/mcp-of-mcps",
        "--config",
        "[{\"name\":\"weather\",\"command\":\"npx\",\"args\":[\"-y\",\"@h1deya/mcp-server-weather\"]},{\"name\":\"time\",\"command\":\"uvx\",\"args\":[\"mcp-server-time\"]}]"
      ]
    }
  }
}
```

**Option 2: Using a config file**

First, create a `config.json` file that specifies which MCP servers to connect to:

```json
[
  {
    "name": "weather",
    "command": "npx",
    "args": ["-y", "@h1deya/mcp-server-weather"]
  },
  {
    "name": "time",
    "command": "uvx",
    "args": ["mcp-server-time"]
  }
]
```

Then reference this file in your Cline settings:

```json
{
  "mcpServers": {
    "mcp-of-mcps": {
      "autoApprove": [],
      "disabled": false,
      "timeout": 60,
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@dbestai/mcp-of-mcps",
        "--config-file",
        "/absolute/path/to/your/config.json"
      ]
    }
  }
}
```

**Configuration Options:**
- `autoApprove`: Array of tool names that don't require approval (e.g., `["get_mcps_servers_overview"]`)
- `disabled`: Set to `false` to enable the server
- `timeout`: Timeout in seconds for tool execution (default: 60)
- `type`: Connection type, always `"stdio"` for MCP servers

## Learn More

This implementation follows the patterns described in Anthropic's article on code execution with MCP:  
📖 [Code execution with MCP: Building more efficient agents](https://www.anthropic.com/engineering/code-execution-with-mcp)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC
