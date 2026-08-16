import pg from 'pg';
import { getAppState, setAppState } from "../appState.js";


export async function executeQuery(query) {
    const appState = getAppState();
    const result = await appState.db.query(query);
    return result;
}


export function loadDatabase() {
    const appState = getAppState();
    const databaseConfig = appState.backend.database;
    if (!databaseConfig) {
        throw new Error('Database configuration not found in app configuration.');
    }

    const { type, host, port, user, password, database } = databaseConfig;

    if(!host) {
        throw new Error('Database host not found in app configuration.');
    }
    if(!port) {
        throw new Error('Database port not found in app configuration.');
    }
    if(!user) {
        throw new Error('Database user not found in app configuration.');
    }
    if(!password) {
        throw new Error('Database password not found in app configuration.');
    }
    if(!database) {
        throw new Error('Database name not found in app configuration.');
    }

    const dbHost = process.env[host];
    const dbPort = process.env[port];
    const dbUser = process.env[user];
    const dbPassword = process.env[password];
    const dbDatabase = process.env[database];

    const db = new pg.Pool({
        host: dbHost,
        port: dbPort,
        user: dbUser,
        password: dbPassword,
        database: dbDatabase,
    });

    setAppState('db', db);
}