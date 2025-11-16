import { McpOfMcps } from "./mcpOfMcps.js";
import { loadConfig } from "./utils.js";


// Start the father with loaded configuration
const config = loadConfig();
const mcpFatherServer = new McpOfMcps(config);
mcpFatherServer.start().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});