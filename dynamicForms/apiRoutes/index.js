import { getModelByName } from "../appState.js";
import { deleteModel } from "../models/deleteModel.js";
import { getModelById } from "../models/getModelById.js";
import { queryModel } from "../models/queryModel.js";
import { saveModel } from "../models/saveModel.js";
import { updateModel } from "../models/updateModel.js";
import { ModelNotFoundError } from "../models/ModelNotFound.js";



export const registerApplicationRoutes = (expressApp, routingConfig) => {
    for (const route of routingConfig) {
        const { path, methods, model: modelName, listFields, queryFields } = route;

        if (methods) {
            for (const method of methods) {
                if (method === 'CREATE') {
                    expressApp.post(path, async (req, res) => {
                        const model = getModelByName(modelName);
                        const data = req.body;
                        try {
                            const result = await saveModel(model, data);
                            res.json(result);
                        } catch (error) {
                            res.status(500).json(error.message);
                        }
                    });
                } else if (method === 'LIST') {
                    expressApp.get(path, async (req, res) => {
                        const model = getModelByName(modelName);
                        try {
                            const result = await queryModel(model, listFields, queryFields, req.query);
                            res.json(result);
                        } catch (error) {
                            res.status(500).json(error.message);
                        }
                    });
                } else if (method === 'GET') {
                    expressApp.get(`${path}/:id`, async (req, res) => {
                        const model = getModelByName(modelName);
                        const id = req.params.id;
                        try {
                            const result = await getModelById(model, id, listFields);
                            res.json(result);
                        } catch (error) {
                            if (error instanceof ModelNotFoundError) {
                                res.status(404).json(error.message);
                            }
                            res.status(500).json(error.message);
                        }
                    });
                } else if (method === 'UPDATE') {
                    expressApp.put(`${path}/:id`, async (req, res) => {
                        const model = getModelByName(modelName);
                        const id = req.params.id;
                        const data = req.body;
                        try {
                            const result = await updateModel(model, id, data, listFields);
                            res.json(result);
                        } catch (error) {
                            if (error instanceof ModelNotFoundError) {
                                res.status(404).json(error.message);
                            }
                            res.status(500).json(error.message);
                        }
                        res.json(result);
                    });
                } else if (method === 'DELETE') {
                    expressApp.delete(`${path}/:id`, async (req, res) => {
                        const model = getModelByName(modelName);
                        const id = req.params.id;
                        try {
                            const result = await deleteModel(model, id);
                            res.json(result);
                        } catch (error) {
                            if (error instanceof ModelNotFoundError) {
                                res.status(404).json(error.message);
                            }
                            res.status(500).json(error.message);
                        }
                    });
                }
            }
        }
    }
}

