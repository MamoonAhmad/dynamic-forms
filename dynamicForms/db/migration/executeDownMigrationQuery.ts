import { getAppState } from "../../appState";
import { DB_TYPE_POSTGRES } from "../constants";
import { executeDownMigrationQuery as executeDownMigrationQueryPostgres } from "../postgres/migration/executeDownMigrationQuery";

export async function executeDownMigrationQuery(
  name: string,
  fileQuery: string,
) {
  const appState = getAppState();
  const dbType = appState.backend.database.type;
  switch (dbType) {
    case DB_TYPE_POSTGRES:
      return executeDownMigrationQueryPostgres(name, fileQuery);
  }
}
