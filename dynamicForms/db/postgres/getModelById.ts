import { escapeQueryValue, escapeIdentifier } from "./escapeQueryValue";
import { executeQuery } from ".";
import { ModelNotFoundError } from "../../models/ModelNotFound";
import { GetModelByIdFunctionProps } from "../types";

export async function getModelById(
  props: GetModelByIdFunctionProps,
): Promise<Record<string, unknown>> {
  const { model, id, listFields } = props;
  if (!id) {
    return { success: false, errors: { id: "ID is required." } };
  }

  let queryId: string | number;
  if (typeof id === "number") {
    queryId = Number(id);
  } else {
    queryId = escapeQueryValue(id);
  }

  const listFieldsString = listFields
    .map((field) => escapeIdentifier(field))
    .join(", ");
  const query = `SELECT ${listFieldsString} FROM ${escapeIdentifier(model.dbTable || model.name)} WHERE ${escapeIdentifier("id")} = ${queryId}`;

  let result;
  try {
    result = await executeQuery(query);
  } catch (error) {
    throw new Error((error as Error).message);
  }

  if (result.rows.length === 0) {
    throw new ModelNotFoundError(`Record with id ${queryId} not found.`);
  }
  return result.rows[0];
}
