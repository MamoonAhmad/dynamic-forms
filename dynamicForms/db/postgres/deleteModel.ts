import { escapeQueryValue, escapeIdentifier } from "./escapeQueryValue";
import { executeQuery } from ".";
import { DeleteModelFunctionProps, DeleteResult } from "../types";

export async function deleteModel(
  props: DeleteModelFunctionProps,
): Promise<DeleteResult> {
  const { model, id } = props;
  if (!id) {
    return { success: false, errors: { id: "ID is required." } };
  }

  let queryId: string | number;
  if (typeof id === "number") {
    queryId = Number(id);
  } else {
    queryId = escapeQueryValue(id);
  }

  const query = `DELETE FROM ${escapeIdentifier(model.dbTable || model.name)} WHERE ${escapeIdentifier("id")} = ${queryId}`;
  try {
    await executeQuery(query);
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
  return { success: true };
}
