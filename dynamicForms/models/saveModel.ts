import { escapeQueryValue } from "./escapeQueryValue";
import { executeQuery } from "../db/postgres";
import type { Model } from "../types";


interface ValidationResult {
    errors: Record<string, string>;
    validatedData: Record<string, unknown>;
}


function validatedata(model: Model, data: Record<string, unknown>): ValidationResult {
    const errors: Record<string, string> = {};

    const validatedData: Record<string, unknown> = {};

    for (const field of model.fields) {
        if (field.required && !data[field.name]) {
            errors[field.name] = `${field.name} is required.`;
        }
        if (data[field.name]) {
            validatedData[field.name] = data[field.name];
        }
    }

    return { errors, validatedData };
}


function createPostgresQuertInsert(
    model: Model,
    validatedData: Record<string, unknown>,
    returnModelFields = false
): string {

    const fields = Object.keys(validatedData).map(key => `"${key}"`);
    const values = Object.keys(validatedData).map(key => escapeQueryValue(validatedData[key]));
    let query = `INSERT INTO ${model.dbTable || model.name} (${fields.join(', ')}) VALUES (${values.join(', ')})`;
    if (returnModelFields) {
        query += ` RETURNING ${model.fields.map(field => `"${field.name}"`).join(', ')}`;
    }
    return query;
}

export async function saveModel(
    model: Model,
    data: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const { errors, validatedData } = validatedata(model, data);
    if (Object.keys(errors).length > 0) {
        return { success: false, errors };
    }

    const query = createPostgresQuertInsert(model, validatedData, true);

    try {
        const result = await executeQuery(query);
        return result.rows[0];
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }

}
