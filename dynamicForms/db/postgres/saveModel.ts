import { escapeQueryValue, escapeIdentifier } from "./escapeQueryValue";
import { Model } from "../../types";
import { executeQuery } from ".";

function createPostgresQueryInsert<T = Record<string, any>>(
  model: Model,
  data: T,
  returnModelFields = false,
): string {

  const validatedData: Record<string, any> = data as {};

  const fields = Object.keys(validatedData).map((key) => escapeIdentifier(key));
  const values = Object.keys(validatedData).map((key) =>
    escapeQueryValue(validatedData[key]),
  );
  const table = escapeIdentifier(model.dbTable || model.name);
  let query = `INSERT INTO ${table} (${fields.join(", ")}) VALUES (${values.join(", ")})`;
  if (returnModelFields) {
    query += ` RETURNING ${model.fields.map((field) => escapeIdentifier(field.name)).join(", ")}`;
  }
  return query;
}

export async function saveModel<T = Record<string, any>>(
  model: Model,
  validatedData: T,
): Promise<T> {
  const query = createPostgresQueryInsert<T>(model, validatedData, true);

  try {
    const result = await executeQuery(query);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
}
