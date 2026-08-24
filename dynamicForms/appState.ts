import type { AppConfig, AppState, Model } from "./types";


const appState: { state: AppState } = {
    state: {} as AppState
};



export const getAppState = (): AppState => {
    return appState.state;
}

export const setAppState = <K extends keyof AppState>(key: K, value: AppState[K]): void => {
    appState.state[key] = value;
}


export const initializeAppState = (appConfig: AppConfig): void => {

    // TODO: validate appConfig
    appState.state = appConfig as AppState;
}


export const getModelByName = (name: string): Model => {
    if (!name) {
        throw new Error('Model name is required');
    }
    return appState.state.models[name];
}
