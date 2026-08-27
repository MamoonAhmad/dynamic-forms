import type { Express } from "express";
import { loadDatabase } from "./db/postgres";
import { registerApplicationRoutes } from "./apiRoutes/index";
import { initializeAppState } from "./appState";
import type { AppConfig } from "./types";





export async function initializeApplication(app: Express, appConfig: AppConfig): Promise<void> {
    initializeAppState(appConfig);
    loadDatabase();
    await registerApplicationRoutes(app, appConfig.backend.apiRoutes);
}
