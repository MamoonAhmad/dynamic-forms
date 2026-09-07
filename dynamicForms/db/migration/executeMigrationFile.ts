import { getAppState } from "../../appState";
import { DB_TYPE_POSTGRES } from "../constants";
import { executeMigrationFile as executeMigrationFilePostgres } from "../postgres/migration/executeMigrationFile";

export async function executeMigrationFile(fileName: string, queries: string) {
  const appState = getAppState();
  const dbType = appState.backend.database.type;
  switch (dbType) {
    case DB_TYPE_POSTGRES:
      return executeMigrationFilePostgres(fileName, queries);
  }
}
