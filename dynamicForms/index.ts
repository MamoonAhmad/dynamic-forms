import type { Express } from "express";
import { loadDatabase } from "./db/postgres";
import { registerApplicationRoutes } from "./apiRoutes/index";
import { initializeAppState } from "./appState";
import type { AppConfig } from "./types";





export function initializeApplication(app: Express, appConfig: AppConfig): void {
    initializeAppState(appConfig);
    loadDatabase();
    registerApplicationRoutes(app, appConfig.backend.apiRoutes);
}
