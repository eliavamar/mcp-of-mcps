import Database from "better-sqlite3";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import {
  StoredTool,
  DatabaseStats,
} from "../../domain/types.js";
import { IServersToolDatabase } from "../../interfaces/IToolDatabase.js";

/**
 * SQLite-based implementation of tool database
 * Only stores output schema to preserve it when servers return undefined
 * Implements Singleton pattern to ensure only one database instance exists
 */
export class ServersToolDatabaseImpl implements IServersToolDatabase {
  private static readonly DEFAULT_DB_PATH = '.database/mcps.db';
  private static instance: ServersToolDatabaseImpl | null = null;

  private db: Database.Database | null = null;
  private dbPath: string;
  private initialized: boolean = false;

  private constructor() {
    this.dbPath = ServersToolDatabaseImpl.resolveDbPath(ServersToolDatabaseImpl.DEFAULT_DB_PATH);
  }

  /**
   * Helper method to resolve database path relative to project root
   * @param dbPath - Relative database file path
   * @returns Absolute path to the database file
   */
  private static resolveDbPath(dbPath: string): string {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const projectRoot = path.resolve(__dirname, "../../../");
    return path.resolve(projectRoot, dbPath);
  }

  /**
   * Get the singleton instance of the database
   * @returns The singleton instance
   */
  static getInstance(): ServersToolDatabaseImpl {
    if (!ServersToolDatabaseImpl.instance) {
      ServersToolDatabaseImpl.instance = new ServersToolDatabaseImpl();
    }
    return ServersToolDatabaseImpl.instance;
  }

  /**
   * Destroy the singleton instance (for testing and cleanup)
   * Closes the database connection and clears the singleton reference
   */
  static destroy(): void {
    if (ServersToolDatabaseImpl.instance) {
      ServersToolDatabaseImpl.instance.close();
      ServersToolDatabaseImpl.instance = null;
      console.error("[ToolDatabase] Singleton instance destroyed");
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Create .database directory if it doesn't exist
    const dbDir = path.dirname(this.dbPath);
    await fs.mkdir(dbDir, { recursive: true });

    // Initialize database connection
    this.db = new Database(this.dbPath);

    // Create schema
    this.createSchema();

    this.initialized = true;
    console.error(`[ToolDatabase] Initialized at ${this.dbPath}`);
  }

  private createSchema(): void {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    // Create tools table - only stores output schema
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        serverName TEXT NOT NULL,
        toolName TEXT NOT NULL,
        outputSchema TEXT,
        originalOutputSchema INTEGER NOT NULL,
        lastUpdated INTEGER NOT NULL,
        UNIQUE(serverName, toolName)
      )
    `);

    // Create index on serverName for faster queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_serverName ON tools(serverName)
    `);
  }

  async saveTool(tool: StoredTool): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const stmt = this.db.prepare(`
      INSERT INTO tools (serverName, toolName, outputSchema, originalOutputSchema, lastUpdated)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(serverName, toolName) DO UPDATE SET
        outputSchema = excluded.outputSchema,
        originalOutputSchema = excluded.originalOutputSchema,
        lastUpdated = excluded.lastUpdated
    `);

    stmt.run(
      tool.serverName,
      tool.toolName,
      tool.outputSchema || null,
      tool.originalOutputSchema ? 1 : 0,
      tool.lastUpdated
    );
  }

  async getTool(
    serverName: string,
    toolName: string
  ): Promise<StoredTool | null> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const stmt = this.db.prepare(`
      SELECT * FROM tools WHERE serverName = ? AND toolName = ?
    `);

    const row = stmt.get(serverName, toolName) as any;
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      serverName: row.serverName,
      toolName: row.toolName,
      outputSchema: row.outputSchema || undefined,
      originalOutputSchema: Boolean(row.originalOutputSchema),
      lastUpdated: row.lastUpdated,
    };
  }

  async getServerTools(serverName: string): Promise<StoredTool[]> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const stmt = this.db.prepare(`
      SELECT * FROM tools WHERE serverName = ?
    `);

    const rows = stmt.all(serverName) as any[];
    return rows.map(row => ({
      id: row.id,
      serverName: row.serverName,
      toolName: row.toolName,
      outputSchema: row.outputSchema || undefined,
      originalOutputSchema: Boolean(row.originalOutputSchema),
      lastUpdated: row.lastUpdated,
    }));
  }

  async updateTool(
    serverName: string,
    toolName: string,
    outputSchema: string,
    originalOutputSchema: boolean
  ): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const stmt = this.db.prepare(`
      UPDATE tools
      SET outputSchema = ?,
          originalOutputSchema = ?,
          lastUpdated = ?
      WHERE serverName = ? AND toolName = ?
    `);

    stmt.run(
      outputSchema,
      originalOutputSchema ? 1 : 0,
      Date.now(),
      serverName,
      toolName
    );
  }

  async getAllTools(): Promise<StoredTool[]> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const stmt = this.db.prepare(`SELECT * FROM tools`);
    const rows = stmt.all() as any[];
    return rows.map(row => ({
      id: row.id,
      serverName: row.serverName,
      toolName: row.toolName,
      outputSchema: row.outputSchema || undefined,
      originalOutputSchema: Boolean(row.originalOutputSchema),
      lastUpdated: row.lastUpdated,
    }));
  }

  async deleteTool(serverName: string, toolName: string): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const stmt = this.db.prepare(`
      DELETE FROM tools WHERE serverName = ? AND toolName = ?
    `);

    stmt.run(serverName, toolName);
  }

  async deleteServerTools(serverName: string): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const stmt = this.db.prepare(`
      DELETE FROM tools WHERE serverName = ?
    `);

    const result = stmt.run(serverName);
    console.error(`[ToolDatabase] Deleted ${result.changes} tools from server '${serverName}'`);
  }

  async getAllServerNames(): Promise<string[]> {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const stmt = this.db.prepare(`
      SELECT DISTINCT serverName FROM tools
    `);

    const rows = stmt.all() as Array<{ serverName: string }>;
    return rows.map(row => row.serverName);
  }

  getStats(): DatabaseStats {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    // Get total tools
    const totalStmt = this.db.prepare(`SELECT COUNT(*) as count FROM tools`);
    const totalResult = totalStmt.get() as { count: number };
    const totalTools = totalResult.count;

    // Get tools by server
    const serverStmt = this.db.prepare(`
      SELECT serverName, COUNT(*) as count FROM tools GROUP BY serverName
    `);
    const serverResults = serverStmt.all() as Array<{
      serverName: string;
      count: number;
    }>;

    const toolsByServer = new Map<string, number>();
    for (const result of serverResults) {
      toolsByServer.set(result.serverName, result.count);
    }

    // Get last update timestamp
    const lastUpdateStmt = this.db.prepare(`
      SELECT MAX(lastUpdated) as lastUpdate FROM tools
    `);
    const lastUpdateResult = lastUpdateStmt.get() as { lastUpdate: number };
    const lastUpdate = lastUpdateResult.lastUpdate || 0;

    return {
      totalTools,
      toolsByServer,
      lastUpdate,
    };
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
      console.error("[ToolDatabase] Closed database connection");
    }
  }
}