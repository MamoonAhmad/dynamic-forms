import { executeQuery } from ".";
import { escapeQueryValue, escapeIdentifier } from "./escapeQueryValue";
import { Model } from "../../types";

function createPostgresQueryUpdate(
  model: Model,
  validatedData: Record<string, unknown>,
  id: string | number,
): string {
  const fields = Object.keys(validatedData).map(
    (key) => `${escapeIdentifier(key)} = ${escapeQueryValue(validatedData[key])}`,
  );
  const table = escapeIdentifier(model.dbTable || model.name);
  return `UPDATE ${table} SET ${fields.join(", ")} WHERE ${escapeIdentifier("id")} = ${escapeQueryValue(id)}`;
}

export const updateModel: (
  model: Model,
  id: string | number,
  validatedData: Record<string, unknown>,
) => Promise<undefined> = async (model, id, validatedData) => {
  const query = createPostgresQueryUpdate(model, validatedData, id);

  try {
    await executeQuery(query);
  } catch (error) {
    throw new Error((error as Error).message);
  }
};
