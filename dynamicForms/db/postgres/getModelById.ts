import { escapeQueryValue } from "./escapeQueryValue";
import { executeQuery } from ".";
import { ModelNotFoundError } from "../../models/ModelNotFound";
import type { Model } from "../../types";




export async function getModelById(
    model: Model,
    id: string | number,
    listFields: string[]
): Promise<Record<string, unknown>> {
    if (!id) {
        return { success: false, errors: { id: 'ID is required.' } };
    }

    let queryId: string | number;
    if (typeof id === 'number') {
        queryId = Number(id);
    } else {
        queryId = escapeQueryValue(id);
    }

    const listFieldsString = listFields.map(field => `"${field}"`).join(', ');
    const query = `SELECT ${listFieldsString} FROM ${model.dbTable || model.name} WHERE id = ${queryId}`;

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
