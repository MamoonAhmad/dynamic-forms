import { getMigrationFileExtension } from "./getMigrationFileExtension";
import fs from "node:fs";

export function createMigrationFile(
  migrationName: string,
  queries: {
    up: string[];
    down: string[];
  },
) {
  migrationName = getMigrationName(migrationName);
  // get the path where the script is running from
  const scriptPath = process.cwd();
  const migrationPath = `${scriptPath}/migrations/${migrationName}`;
  const fileExtension = getMigrationFileExtension();

  fs.mkdirSync(migrationPath, { recursive: true });
  fs.writeFileSync(
    `${migrationPath}/up.${fileExtension}`,
    queries.up.join("\n"),
  );
  fs.writeFileSync(
    `${migrationPath}/down.${fileExtension}`,
    queries.down.join("\n"),
  );
}

function getMigrationName(migrationName: string) {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  return `migration_${timestamp}_${migrationName}.sql`;
}
