import { getModelById } from "./getModelById";
import { escapeQueryValue } from "./escapeQueryValue";
import { executeQuery } from "../db/postgres";
import { ModelNotFoundError } from "./ModelNotFound";
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

function createPostgresQuertUpdate(
    model: Model,
    validatedData: Record<string, unknown>,
    id: string | number
): string {
    const fields = Object.keys(validatedData).map(key => `"${key}" = ${escapeQueryValue(validatedData[key])}`);
    return `UPDATE ${model.dbTable || model.name} SET ${fields.join(', ')} WHERE id = ${id}`;
}

export async function updateModel(
    model: Model,
    id: string | number,
    data: Record<string, unknown>,
    listFields: string[]
): Promise<Record<string, unknown>> {

    if (!id) {
        throw new Error('ID is required.');
    }
    if (!data) {
        throw new Error('Data is required.');
    }
    // check if record with id exists
    try {
        await getModelById(model, id, ['id']);
    } catch (error) {
        if (error instanceof ModelNotFoundError) {
            throw new Error('Record not found.');
        }
        throw new Error((error as Error).message);
    }



    const { errors, validatedData } = validatedata(model, data);
    if (Object.keys(errors).length > 0) {
        throw new Error(JSON.stringify(errors));
    }

    const query = createPostgresQuertUpdate(model, validatedData, id);

    try {
        await executeQuery(query);
    } catch (error) {
        throw new Error((error as Error).message);
    }


    return getModelById(model, id, listFields);
}
