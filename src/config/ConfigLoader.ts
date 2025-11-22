import { McpServerConnectionConfig } from "../domain/types.js";
import * as fs from "fs";
/**
 * ConfigLoader handles loading configuration from various sources
 */
export class ConfigLoader {
  /**
   * Parse configuration from command line arguments or environment variable
   * @returns Array of server configurations
   * @throws Error if no configuration is provided
   */
  static loadConfig(): McpServerConnectionConfig[] {
    // Option 1: From environment variable MCP_SERVERS_CONFIG
    if (process.env.MCP_SERVERS_CONFIG) {
      try {
        return JSON.parse(process.env.MCP_SERVERS_CONFIG);
      } catch (error) {
        console.error("Error parsing MCP_SERVERS_CONFIG:", error);
        process.exit(1);
      }
    }

    // Option 2: From command line argument --config
    const configIndex = process.argv.indexOf("--config");
    if (configIndex !== -1 && process.argv[configIndex + 1]) {
      try {
        return JSON.parse(process.argv[configIndex + 1]);
      } catch (error) {
        console.error("Error parsing --config argument:", error);
        process.exit(1);
      }
    }

    // Option 3: From config file path --config-file
    const configFileIndex = process.argv.indexOf("--config-file");
    if (configFileIndex !== -1 && process.argv[configFileIndex + 1]) {
      try {
        const configFile = process.argv[configFileIndex + 1];
        const fileContent = fs.readFileSync(configFile, "utf-8");
        return JSON.parse(fileContent);
      } catch (error) {
        console.error("Error reading config file:", error);
        process.exit(1);
      }
    }

    console.error("No configuration provided. Use one of:");
    console.error("  - Environment variable: MCP_SERVERS_CONFIG");
    console.error("  - Command line: --config '<json>'");
    console.error("  - Config file: --config-file <path>");
    process.exit(1);
  }
}
