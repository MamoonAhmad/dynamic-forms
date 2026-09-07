import fs from "node:fs";
import { getAppState } from "../../appState";
import { assertMigrationTableExists } from "./assertMigrationTableExists";
import { createMigrationFile } from "./createMigrationFile";
import { executeMigrationFile } from "./executeMigrationFile";
import { getAllMigrations } from "./getAllMigrations";
import { getModelMigrationQueries } from "./getModelMigrationQueries";
import { getScriptPath } from "./getScriptPath";
import { readOldModels } from "./readOldModels";
import { getMigrationFileExtension } from "./getMigrationFileExtension";
import { executeDownMigrationQuery } from "./executeDownMigrationQuery";
import { writeAppliedSchema } from "./writeAppliedSchema";

/**
 * Make Migration
 * get migration name from user - shared
 * read current models - shared
 * read old models - shared
 * generate queries by comparing old models vs new models
 *  - compare each model and field - shared
 *  - generate queries for differences - db specific
 * get migration file name - shared
 * write queries in the file - shared
 *
 *
 *
 * Migrate
 * assert db table for migrations exists or create one - db specific
 * get all migrations from the db - db specific
 * create a map of migration by name - let it be db specific
 * get all the migrations present in the folder by filename - shared
 * compare the migrations present in db by map by migrations present in the folder - shared
 * run the all the migration files that are not present in db in transaction - db specific
 * log to console what migrations ran - shared
 */

export function makeMigration(migrationName: string) {
  const appState = getAppState();
  const newModels = appState.models;
  const oldModels = readOldModels();

  const migrationQueries = getModelMigrationQueries(oldModels, newModels);

  if (!migrationQueries?.up?.length || !migrationQueries?.down?.length) {
    throw new Error("Could not generate queries for migration. TODO FIX ERROR");
  }

  const migrationNameSnakeCase = migrationName
    .replace(/\s+/g, "_")
    .toLowerCase();
  createMigrationFile(migrationNameSnakeCase, migrationQueries);
}

export async function migrate() {
  await assertMigrationTableExists();
  const allMigrationRecords = await getAllMigrations();
  if (!allMigrationRecords) {
    throw new Error("Could not get existing migration records");
  }

  // read migrations folder and get all file names
  const scriptPath = getScriptPath();
  const migrationPath = `${scriptPath}/migrations`;

  if (!fs.existsSync(migrationPath)) {
    return;
  }

  // Apply in timestamped filename order so dependent migrations run in sequence.
  const migrationFiles = fs.readdirSync(migrationPath).sort();
  const fileExtension = getMigrationFileExtension();

  let appliedCount = 0;
  for (const fileName of migrationFiles) {
    const existing = allMigrationRecords.get(fileName);

    if (existing) {
      if (existing.failure_reason) {
        throw new Error(
          `Migration ${fileName} has already failed with reason: ${existing.failure_reason}. Fix the issue, delete the record from the migrations table, and try again.`,
        );
      }
      // already applied successfully
      continue;
    }

    const queries = fs
      .readFileSync(`${migrationPath}/${fileName}/up.${fileExtension}`)
      .toString();
    try {
      await executeMigrationFile(fileName, queries);
      console.log(`Migration successful ${fileName}.`);
      appliedCount++;
    } catch (e) {
      throw new Error(`Could not execute migration ${fileName}: ${e}`);
    }
  }

  // Snapshot the now-applied schema so the next makeMigration diffs against it.
  if (appliedCount > 0) {
    writeAppliedSchema(getAppState().models);
  }
}

export async function migrateDown(name: string) {
  // read migrations folder and get all file names
  const scriptPath = getScriptPath();
  const migrationPath = `${scriptPath}/migrations`;

  const migrationFiles = fs.readdirSync(migrationPath);
  const fileExtension = getMigrationFileExtension();

  const migrations = [];
  for (const migrationName of migrationFiles) {
    if (migrationName.includes(name)) {
      migrations.push(migrationName);
    }
  }

  if (migrations.length === 0) {
    throw new Error(`No migration found matching "${name}".`);
  }

  if (migrations.length > 1) {
    throw new Error(
      `More than 1 migration matches "${name}". Use a more specific name to select only 1: ${migrations.join(", ")}`,
    );
  }

  const downMigrationContent = fs
    .readFileSync(`${migrationPath}/${migrations[0]}/down.${fileExtension}`)
    .toString();

  await executeDownMigrationQuery(migrations[0], downMigrationContent);
}
