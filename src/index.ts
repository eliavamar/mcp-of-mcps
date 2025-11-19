#!/usr/bin/env node
import { AppFactory } from "./config/AppFactory.js";
import { ConfigLoader } from "./config/ConfigLoader.js";

// Load configuration from command line or environment
const config = ConfigLoader.loadConfig();

// Create and start the MCP server using the factory
const mcpServer = AppFactory.createMcpServer(config);
mcpServer.start().catch((error: Error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
