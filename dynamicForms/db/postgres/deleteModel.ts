import { escapeQueryValue } from "./escapeQueryValue";
import { executeQuery } from ".";
import type { Model } from "../../types";
import { DeleteResult } from "../types";





export async function deleteModel(model: Model, id: string | number): Promise<DeleteResult> {
    if (!id) {
        return { success: false, errors: { id: 'ID is required.' } };
    }

    let queryId: string | number;
    if (typeof id === 'number') {
        queryId = Number(id);
    } else {
        queryId = escapeQueryValue(id);
    }

    const query = `DELETE FROM ${model.dbTable || model.name} WHERE id = ${queryId}`;
    try {
        await executeQuery(query);
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
    return { success: true };
}
