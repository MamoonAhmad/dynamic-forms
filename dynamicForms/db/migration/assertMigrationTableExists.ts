import { getAppState } from "../../appState";
import { DB_TYPE_POSTGRES } from "../constants";

import { assertMigrationTableExists as assertMigrationTableExistsPostgres } from "../postgres/migration/assertMigrationTableExists";

export async function assertMigrationTableExists() {
  const appState = getAppState();

  const dbType = appState.backend.database.type;

  switch (dbType) {
    case DB_TYPE_POSTGRES:
      return assertMigrationTableExistsPostgres();
  }
}
