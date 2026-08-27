import type { Model } from "../types";
import { getAppState, getModelByName } from "../appState";
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

export async function saveModel(modelName: string) {
  return async (req: Request, res: Response) => {
    const appState = getAppState();
    const model = getModelByName(modelName);
    const db = appState.db!;
    const data = req.body;

    const { errors, validatedData } = validateData(model, data);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    try {
      const result = await db.saveModel<Record<string, unknown>>(
        model,
        validatedData,
      );
      res.json(result);
    } catch (error) {
      const errorString = error?.toString();
      res.status(500).json({
        error: errorString ?? `Error saving ${modelName}.`,
      });
    }
  };
}
