import { escapeQueryValue } from "./escapeQueryValue.js";
import { executeQuery } from "../db/postgres.js";





function validatedata(model, data) {
    const errors = {};

    const validatedData = {}

    for (const field of model.fields) {
        if (field.required && !data[field.name]) {
            errors[field.name] = `${field.name} is required.`;
        }
        if(data[field.name]) {
            validatedData[field.name] = data[field.name];
        }
    }

    return {errors, validatedData};
}


function createPostgresQuertInsert(model, validatedData, returnModelFields = false) {

    const fields = Object.keys(validatedData).map(key => `"${key}"`);
    const values = Object.keys(validatedData).map(key => escapeQueryValue(validatedData[key]));
    let query = `INSERT INTO ${model.dbTable || model.name} (${fields.join(', ')}) VALUES (${values.join(', ')})`;
    if (returnModelFields) {
        query += ` RETURNING ${model.fields.map(field => `"${field.name}"`).join(', ')}`;
    }
    return query;
}

export async function saveModel(model, data) {
    const {errors, validatedData} = validatedata(model, data);
    if (Object.keys(errors).length > 0) {
        return { success: false, errors };
    }

    const query = createPostgresQuertInsert(model, validatedData, true);

    try {
        const result = await executeQuery(query);
        return result.rows[0];
    } catch (error) {
        return { success: false, error: error.message };
    }

}
