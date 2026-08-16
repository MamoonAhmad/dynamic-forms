

const appState = {
    state: {}
};



export const getAppState = () => {
    return appState.state;
}

export const setAppState = (key, value) => {
    appState.state[key] = value;
}


export const initializeAppState = (appConfig) => {

    // TODO: validate appConfig
    appState.state = appConfig;
}


export const getModelByName = (name) => {
    if (!name) {
        throw new Error('Model name is required');
    }
    return appState.state.models[name];
}