import { getAppState } from "../../appState";
import { DB_TYPE_POSTGRES } from "../constants";
import { getModelMigrationQueries as getModelMigrationQueriesPostgres } from "../postgres/migration/getModelMigrationQueries";
import { Model } from "../types";

export function getModelMigrationQueries(oldModels: Model[], newModels: Model[]) {
  const appState = getAppState();
  const dbType = appState.backend.database.type;

  switch (dbType) {
    case DB_TYPE_POSTGRES:
      return getModelMigrationQueriesPostgres(oldModels, newModels);
  }
}
