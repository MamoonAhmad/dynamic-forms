import { executeQuery } from ".";
import { Model, UpdateModelFunctionProps } from "../types";
import { escapeQueryValue, escapeIdentifier } from "./escapeQueryValue";

function createPostgresQueryUpdate(
  model: Model,
  validatedData: Record<string, unknown>,
  id: string | number,
): string {
  const fields = Object.keys(validatedData).map(
    (key) =>
      `${escapeIdentifier(key)} = ${escapeQueryValue(validatedData[key])}`,
  );
  const table = escapeIdentifier(model.dbTable || model.name);
  return `UPDATE ${table} SET ${fields.join(", ")} WHERE ${escapeIdentifier("id")} = ${escapeQueryValue(id)}`;
}

export const updateModel: (
  props: UpdateModelFunctionProps,
) => Promise<undefined> = async (props) => {
  const { model, id, data } = props;

  const query = createPostgresQueryUpdate(model, data, id);

  try {
    await executeQuery(query);
  } catch (error) {
    throw new Error((error as Error).message);
  }
};
