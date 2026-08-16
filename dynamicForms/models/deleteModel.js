



export async function deleteModel(model, id) {
    if (!id) {
        return { success: false, errors: { id: 'ID is required.' } };
    }
    if(typeof id === 'number') {
        id = Number(id);
    } else {
        id = escapeQueryValue(id);
    }
    const query = `DELETE FROM ${model.dbTable || model.name} WHERE id = ${id}`;
    let result;
    try {
        result = await executeQuery(query);
    } catch (error) {
        return { success: false, error: error.message };
    }
    return { success: true };
}