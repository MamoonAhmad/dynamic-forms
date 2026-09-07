import { getAppState } from "../../appState";
import { DB_TYPE_POSTGRES } from "../constants";
import { getMigrationFileExtension as getMigrationFileExtensionPostgres } from "../postgres/migration/getMigrationFileExtension";

export function getMigrationFileExtension() {
  const appState = getAppState();
  const dbType = appState.backend.database.type;
  switch (dbType) {
    case DB_TYPE_POSTGRES:
      return getMigrationFileExtensionPostgres();
  }
}
