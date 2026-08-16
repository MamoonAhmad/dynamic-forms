import { getModelById } from "./getModelById.js";
import { escapeQueryValue } from "./escapeQueryValue.js";
import { executeQuery } from "../db/postgres.js";





function validatedata(model, data) {
    const errors = {};
    const validatedData = {};
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

function createPostgresQuertUpdate(model, validatedData, id) {
    const fields = Object.keys(validatedData).map(key => `"${key}" = ${escapeQueryValue(validatedData[key])}`);
    return `UPDATE ${model.dbTable || model.name} SET ${fields.join(', ')} WHERE id = ${id}`;
}

export async function updateModel(model, id, data, listFields) {

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
        throw new Error(error.message);
    }



    const {errors, validatedData} = validatedata(model, data);
    if (Object.keys(errors).length > 0) {
        throw new Error(errors);
    }

    const query = createPostgresQuertUpdate(model, validatedData, id);

    let result;
    try {
        result = await executeQuery(query);
    } catch (error) {
        throw new Error(error.message);
    }


    return getModelById(model, id, listFields);
}