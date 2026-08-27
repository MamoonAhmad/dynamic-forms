import { getAppState, getModelByName } from "../appState";
import { ModelNotFoundError } from "./ModelNotFound";
import { Request, Response } from "express";

export async function getModel(modelName: string, listFields: string[]) {
  return async (req: Request, res: Response) => {
    const appState = getAppState();
    const model = getModelByName(modelName);
    const db = appState.db!;
    const id = String(req.params.id);

    try {
      const result = await db.getModelById(model, id, listFields);
      res.json(result);
    } catch (error) {
      if (error instanceof ModelNotFoundError) {
        return res.status(404).json({ error: (error as Error).message });
      }
      const errorString = error?.toString();
      res.status(500).json({
        error: errorString ?? `Error getting ${modelName}.`,
      });
    }
  };
}
