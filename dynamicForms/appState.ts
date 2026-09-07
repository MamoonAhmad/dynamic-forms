import { Model } from "./db/types";
import type { AppConfig, AppState } from "./types";

const appStateProcess: {
  modelsMap: Record<string, Model>;
} = {
  modelsMap: {},
};

const appState: { state: AppState } = {
  state: {} as AppState,
};

export const getAppState = (): AppState => {
  return appState.state;
};

export const setAppState = <K extends keyof AppState>(
  key: K,
  value: AppState[K],
): void => {
  appState.state[key] = value;
};

export const initializeAppState = (appConfig: AppConfig): void => {
  // TODO: validate appConfig
  appState.state = appConfig as AppState;
  appStateProcess.modelsMap = {};
  appConfig.models.forEach((model) => {
    appStateProcess.modelsMap[model.name] = model;
  });
};

export const getModelByName = (name: string): Model => {
  if (!name) {
    throw new Error("Model name is required");
  }
  return appStateProcess.modelsMap[name];
};
