import type Database from "better-sqlite3";
// 单独事务避免多个 worker 同时检测、重复添加同一列。
export function migratePostDetails(db: Database.Database) {
  db.transaction(() => {
    const columns = db.prepare("PRAGMA table_info(posts)").all() as {
      name: string;
    }[];
    if (!columns.some((column) => column.name === "details")) {
      db.exec(
        "ALTER TABLE posts ADD COLUMN details TEXT NOT NULL DEFAULT '{}'",
      );
    }
  }).immediate();
}
