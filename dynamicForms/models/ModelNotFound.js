


export class ModelNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ModelNotFoundError';
    }
}