import { loadDatabase } from "./db/postgres.js";
import { registerApplicationRoutes } from "./apiRoutes/index.js";
import { initializeAppState } from "./appState.js";





export function initializeApplication(app, appConfig) {
    initializeAppState(appConfig);
    loadDatabase();
    registerApplicationRoutes(app, appConfig.backend.apiRoutes);
}