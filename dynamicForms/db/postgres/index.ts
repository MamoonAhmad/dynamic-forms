import pg from "pg";
import type { Pool, QueryResult } from "pg";
import { getAppState, setAppState } from "../../appState";
import { queryModel } from "./queryModel";
import { getModelById } from "./getModelById";
import { deleteModel } from "./deleteModel";
import { updateModel } from "./updateModel";
import { saveModel } from "./saveModel";

const dbConnectionObject: {
  pool: Pool | undefined;
} = { pool: undefined };

export async function executeQuery(query: string): Promise<QueryResult> {
  if (!dbConnectionObject.pool) {
    throw new Error("Database has not been initialized.");
  }
  const result = await dbConnectionObject.pool.query(query);
  return result;
}

export function loadDatabase(): void {
  const appState = getAppState();
  const databaseConfig = appState.backend.database;
  if (!databaseConfig) {
    throw new Error("Database configuration not found in app configuration.");
  }

  const { host, port, user, password, database } = databaseConfig;

  if (!host) {
    throw new Error("Database host not found in app configuration.");
  }
  if (!port) {
    throw new Error("Database port not found in app configuration.");
  }
  if (!user) {
    throw new Error("Database user not found in app configuration.");
  }
  if (!password) {
    throw new Error("Database password not found in app configuration.");
  }
  if (!database) {
    throw new Error("Database name not found in app configuration.");
  }

  const dbHost = process.env[host];
  const dbPort = process.env[port];
  const dbUser = process.env[user];
  const dbPassword = process.env[password];
  const dbDatabase = process.env[database];

  dbConnectionObject.pool = new pg.Pool({
    host: dbHost,
    port: dbPort ? Number(dbPort) : undefined,
    user: dbUser,
    password: dbPassword,
    database: dbDatabase,
  });

  setAppState("db", {
    queryModel,
    getModelById,
    deleteModel,
    updateModel,
    saveModel,
  });
}
