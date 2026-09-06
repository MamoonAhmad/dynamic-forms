import type { DisabledFilters } from "../../types";
import { getAppState, getModelByName } from "../../appState";
import { Request, Response } from "express";
import { parseListQuery } from "../parseListQuery";

export async function listModel(
  modelName: string,
  listFields: string[],
  disabledFilters: DisabledFilters,
) {
  return async (req: Request, res: Response) => {
    const appState = getAppState();
    const model = getModelByName(modelName);
    const db = appState.db!;

    try {
      const { queryFields, limit, offset } = parseListQuery(
        req.query,
        disabledFilters,
      );
      const result = await db.queryModel({
        model,
        listFields,
        queryFields,
        limit,
        offset,
        countTotal: true,
      });
      res.status(200).json(result);
    } catch (error) {
      const errorString = error?.toString();
      res.status(500).json({
        error: errorString ?? `Error listing ${modelName}.`,
      });
    }
  };
}
