import type { QueryFields, QueryParams } from "../types";
import { getAppState, getModelByName } from "../appState";
import { Request, Response } from "express";

export async function listModel(
  modelName: string,
  listFields: string[],
  queryFields: QueryFields,
) {
  return async (req: Request, res: Response) => {
    const appState = getAppState();
    const model = getModelByName(modelName);
    const db = appState.db!;

    try {
      const result = await db.queryModel(
        model,
        listFields,
        queryFields,
        req.query as QueryParams,
      );
      res.json(result);
    } catch (error) {
      const errorString = error?.toString();
      res.status(500).json({
        error: errorString ?? `Error listing ${modelName}.`,
      });
    }
  };
}
