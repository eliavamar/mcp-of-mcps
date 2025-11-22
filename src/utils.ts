import { Tool } from '@modelcontextprotocol/sdk/types.js';
import toJsonSchema from 'to-json-schema';

/**
 * Utility function to convert tool names (replace hyphens with underscores)
 */
export function convertToolName(input: string): string {
  return input.replace(/-/g, "_");
}

/**
 * Converts MCP tool output to a JSON Schema outputSchema format
 * @param output - The raw output from an MCP tool
 * @returns A JSON Schema object describing the output structure
 */
export function convertOutputToSchema(output: any): Tool["outputSchema"] | undefined {
  // Use to-json-schema to generate schema from the output
  const schema = toJsonSchema(output);
  return schema as Tool["outputSchema"];
}
