import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "db", "ecoticker.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    // Ensure directory exists
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      try {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log(`Created database directory: ${dbDir}`);
      } catch (err) {
        console.error(`Failed to create database directory: ${dbDir}`, err);
        throw new Error(`Cannot create database directory: ${dbDir}. Check volume mount path.`);
      }
    }

    try {
      db = new Database(DB_PATH);
      db.pragma("journal_mode = WAL");
      db.pragma("foreign_keys = ON");

      // Run schema if tables don't exist
      const schemaPath = path.join(process.cwd(), "db", "schema.sql");
      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, "utf-8");
        db.exec(schema);
      }

      console.log(`Database initialized at: ${DB_PATH}`);
    } catch (err) {
      console.error(`Failed to open database at: ${DB_PATH}`, err);
      console.error(`DATABASE_PATH env var: ${process.env.DATABASE_PATH}`);
      console.error(`Directory exists: ${fs.existsSync(dbDir)}`);
      console.error(`Directory writable: ${fs.accessSync ? 'checking...' : 'unknown'}`);
      throw err;
    }
  }
  return db;
}
