import type Database from "better-sqlite3";
export function migrateEditorial(db: Database.Database) {
  db.transaction(() => {
    const columns = db.prepare("PRAGMA table_info(posts)").all() as {
      name: string;
    }[];
    if (!columns.some((c) => c.name === "editorial"))
      db.exec(
        "ALTER TABLE posts ADD COLUMN editorial TEXT NOT NULL DEFAULT '{}' ",
      );
    db.exec(
      "CREATE TABLE IF NOT EXISTS editorial_ai_config(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL)",
    );
  }).immediate();
}
