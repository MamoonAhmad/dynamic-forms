import type { Express, Request, Response } from "express";
import { getModelByName } from "../appState";
import { deleteModel } from "../models/deleteModel";
import { getModelById } from "../models/getModelById";
import { queryModel } from "../models/queryModel";
import { saveModel } from "../models/saveModel";
import { updateModel } from "../models/updateModel";
import { ModelNotFoundError } from "../models/ModelNotFound";
import type { QueryParams, RouteConfig } from "../types";



export const registerApplicationRoutes = (expressApp: Express, routingConfig: RouteConfig[]): void => {
    for (const route of routingConfig) {
        const { path, methods, model: modelName, listFields, queryFields } = route;

        if (methods) {
            for (const method of methods) {
                if (method === 'CREATE') {
                    expressApp.post(path, async (req: Request, res: Response) => {
                        const model = getModelByName(modelName);
                        const data = req.body;
                        try {
                            const result = await saveModel(model, data);
                            res.json(result);
                        } catch (error) {
                            res.status(500).json((error as Error).message);
                        }
                    });
                } else if (method === 'LIST') {
                    expressApp.get(path, async (req: Request, res: Response) => {
                        const model = getModelByName(modelName);
                        try {
                            const result = await queryModel(model, listFields, queryFields, req.query as QueryParams);
                            res.json(result);
                        } catch (error) {
                            res.status(500).json((error as Error).message);
                        }
                    });
                } else if (method === 'GET') {
                    expressApp.get(`${path}/:id`, async (req: Request, res: Response) => {
                        const model = getModelByName(modelName);
                        const id = String(req.params.id);
                        try {
                            const result = await getModelById(model, id, listFields);
                            res.json(result);
                        } catch (error) {
                            if (error instanceof ModelNotFoundError) {
                                res.status(404).json((error as Error).message);
                            }
                            res.status(500).json((error as Error).message);
                        }
                    });
                } else if (method === 'UPDATE') {
                    expressApp.put(`${path}/:id`, async (req: Request, res: Response) => {
                        const model = getModelByName(modelName);
                        const id = String(req.params.id);
                        const data = req.body;
                        try {
                            const result = await updateModel(model, id, data, listFields);
                            res.json(result);
                        } catch (error) {
                            if (error instanceof ModelNotFoundError) {
                                res.status(404).json((error as Error).message);
                            }
                            res.status(500).json((error as Error).message);
                        }
                    });
                } else if (method === 'DELETE') {
                    expressApp.delete(`${path}/:id`, async (req: Request, res: Response) => {
                        const model = getModelByName(modelName);
                        const id = String(req.params.id);
                        try {
                            const result = await deleteModel(model, id);
                            res.json(result);
                        } catch (error) {
                            if (error instanceof ModelNotFoundError) {
                                res.status(404).json((error as Error).message);
                            }
                            res.status(500).json((error as Error).message);
                        }
                    });
                }
            }
        }
    }
}
