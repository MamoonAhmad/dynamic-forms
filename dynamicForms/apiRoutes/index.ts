import type { Express } from "express";
import { saveModel } from "../models/saveModel";
import { updateModel } from "../models/updateModel";
import { getModel } from "../models/getModel";
import { listModel } from "../models/listModel";
import { deleteModel } from "../models/deleteModel";
import type { RouteConfig } from "../types";

export const registerApplicationRoutes = async (
  expressApp: Express,
  routingConfig: RouteConfig[],
): Promise<void> => {
  for (const route of routingConfig) {
    const { path, methods, model: modelName, listFields, queryFields } = route;

    if (!methods) {
      continue;
    }

    for (const method of methods) {
      if (method === "CREATE") {
        expressApp.post(path, await saveModel(modelName));
      } else if (method === "LIST") {
        expressApp.get(path, await listModel(modelName, listFields, queryFields));
      } else if (method === "GET") {
        expressApp.get(`${path}/:id`, await getModel(modelName, listFields));
      } else if (method === "UPDATE") {
        expressApp.put(`${path}/:id`, await updateModel(modelName, listFields));
      } else if (method === "DELETE") {
        expressApp.delete(`${path}/:id`, await deleteModel(modelName));
      }
    }
  }
};
