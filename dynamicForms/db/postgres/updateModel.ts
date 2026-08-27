import { executeQuery } from ".";
import { escapeQueryValue } from "./escapeQueryValue";
import { Model } from "../../types";

function createPostgresQueryUpdate(
  model: Model,
  validatedData: Record<string, unknown>,
  id: string | number,
): string {
  const fields = Object.keys(validatedData).map(
    (key) => `"${key}" = ${escapeQueryValue(validatedData[key])}`,
  );
  return `UPDATE ${model.dbTable || model.name} SET ${fields.join(", ")} WHERE id = ${id}`;
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
