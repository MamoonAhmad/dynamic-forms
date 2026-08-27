import { getAppState } from "../appState";

export const assertDbPresent = () => {
  const appState = getAppState();
  if (!appState.db) {
    // TODO: Log proper error
    throw new Error("Database not initialized.");
  }
};
