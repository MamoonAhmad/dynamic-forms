import { getAppState } from "../../appState";
import { DB_TYPE_POSTGRES } from "../constants";
import { getAllMigrations as getAllMigrationsPostgres } from "../postgres/migration/getAllMigrations";

export async function getAllMigrations() {
  const appState = getAppState();
  const dbType = appState.backend.database.type;

  switch (dbType) {
    case DB_TYPE_POSTGRES:
      return getAllMigrationsPostgres();
  }
}
