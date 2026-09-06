import type { Express } from "express";
import { saveModel } from "./handlers/saveModel";
import { updateModel } from "./handlers/updateModel";
import { getModel } from "./handlers/getModel";
import { listModel } from "./handlers/listModel";
import { deleteModel } from "./handlers/deleteModel";
import type { RouteConfig } from "../types";

export const registerApplicationRoutes = async (
  expressApp: Express,
  routingConfig: RouteConfig[],
): Promise<void> => {
  for (const route of routingConfig) {
    const { path, methods, model: modelName, listFields, disabledFilters } = route;

    if (!methods) {
      continue;
    }

    for (const method of methods) {
      if (method === "CREATE") {
        expressApp.post(path, await saveModel(modelName));
      } else if (method === "LIST") {
        expressApp.get(path, await listModel(modelName, listFields, disabledFilters));
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
