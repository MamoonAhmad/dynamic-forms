import type { Model } from "../types";
import { getAppState, getModelByName } from "../appState";
import { ModelNotFoundError } from "./ModelNotFound";
import { Request, Response } from "express";

interface ValidationResult {
  errors: Record<string, string>;
  validatedData: Record<string, unknown>;
}

function validateData(
  model: Model,
  data: Record<string, unknown>,
): ValidationResult {
  const errors: Record<string, string> = {};

  const validatedData: Record<string, unknown> = {};

  for (const field of model.fields) {
    if (field.required && !data[field.name]) {
      errors[field.name] = `${field.name} is required.`;
    }
    if (data[field.name]) {
      validatedData[field.name] = data[field.name];
    }
  }

  return { errors, validatedData };
}

export async function updateModel(modelName: string, listFields: string[]) {
  return async (req: Request, res: Response) => {
    const appState = getAppState();
    const model = getModelByName(modelName);
    const db = appState.db!;
    const id = String(req.params.id);
    const data = req.body;

    if (!id) {
      return res.status(400).json({ error: "ID is required." });
    }
    if (!data) {
      return res.status(400).json({ error: "Data is required." });
    }

    // check if record with id exists
    try {
      await db.getModelById(model, id, ["id"]);
    } catch (error) {
      if (error instanceof ModelNotFoundError) {
        return res.status(404).json({ error: "Record not found." });
      }
      return res.status(500).json({ error: (error as Error).message });
    }

    const { errors, validatedData } = validateData(model, data);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    try {
      await db.updateModel(model, id, validatedData);
      const result = await db.getModelById(model, id, listFields);
      res.json(result);
    } catch (error) {
      const errorString = error?.toString();
      res.status(500).json({
        error: errorString ?? `Error updating ${modelName}.`,
      });
    }
  };
}
