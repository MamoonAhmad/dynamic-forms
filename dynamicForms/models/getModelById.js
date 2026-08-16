import { escapeQueryValue } from "./escapeQueryValue.js";
import { executeQuery } from "../db/postgres.js";
import { ModelNotFoundError } from "./ModelNotFound.js";




export async function getModelById(model, id, listFields) {
    if (!id) {
        return { success: false, errors: { id: 'ID is required.' } };
    }
    
    if(typeof id === 'number') {
        id = Number(id);
    } else {
        id = escapeQueryValue(id);
    }

    const listFieldsString = listFields.map(field => `"${field}"`).join(', ');
    const query = `SELECT ${listFieldsString} FROM ${model.dbTable || model.name} WHERE id = ${id}`;

    let result;
    try {
        result = await executeQuery(query);
    } catch (error) {
        throw new Error(error.message);
    }
    
    if (result.rows.length === 0) {
        throw new ModelNotFoundError(`Record with id ${id} not found.`);
    }
    return result.rows[0];
}