import { executeQuery } from "../db/postgres";
import { escapeQueryValue } from "./escapeQueryValue";
import type { Model, QueryFields, QueryParams } from "../types";

export async function queryModel(
    model: Model,
    listFields: string[],
    queryFields: QueryFields,
    query: QueryParams
): Promise<{ data: unknown[]; total: unknown; resultCount: number | null }> {

    // The query-field config is accessed in several dynamic shapes (boolean,
    // operator maps, custom query objects); treat it loosely here.
    const qf = queryFields as Record<string, any>;

    const dbQueries: string[] = [];

    const page = Number(query.page) || 1;
    const perPage = Number(query.perPage) || 10;
    const offset = (page - 1) * perPage;

    Object.keys(query).forEach(key => {

        const queryValue = query[key];

        let fieldKey = key;
        if (key.includes('__')) {
            fieldKey = key.split('__')[0];
        }

        if (qf[fieldKey] === false) {
            throw new Error(`Invalid query parameter: ${key}`);
        }

        if (key.includes('__')) {
            const [innerFieldKey, operator] = key.split('__');
            if (qf?.[innerFieldKey]?.[operator] !== false) {
                const valueToQuery = query[key];
                if (valueToQuery) {
                    switch (operator) {
                        case 'lte':
                            dbQueries.push(`"${innerFieldKey}" <= ${escapeQueryValue(valueToQuery)}`);
                            break;
                        case 'gte':
                            dbQueries.push(`"${innerFieldKey}" >= ${escapeQueryValue(valueToQuery)}`);
                            break;
                        case 'lt':
                            dbQueries.push(`"${innerFieldKey}" < ${escapeQueryValue(valueToQuery)}`);
                            break;
                        case 'gt':
                            dbQueries.push(`"${innerFieldKey}" > ${escapeQueryValue(valueToQuery)}`);
                            break;
                        case 'is_null':
                            dbQueries.push(`"${innerFieldKey}" IS NULL`);
                            break;
                        case 'is_not_null':
                            dbQueries.push(`"${innerFieldKey}" IS NOT NULL`);
                            break;
                        case 'contains':
                            dbQueries.push(`"${innerFieldKey}" ILIKE ${escapeQueryValue(`%${valueToQuery}%`)}`);
                            break;
                        default:
                            throw new Error(`Invalid operator: ${operator}`);
                    }
                }
            }
            else {
                throw new Error(`Invalid query parameter: ${key}`);
            }
        } else {
            // if key is not in query fields but is a model field, do `=` query
            const modelField = model.fields.find(field => field.name === fieldKey);
            if (modelField && qf?.[fieldKey] === undefined) {
                dbQueries.push(`"${fieldKey}" = ${escapeQueryValue(queryValue)}`);
            } else if (qf?.[key] && typeof qf[key] === 'object') {
                // check for custom query fields
                const queryObject = qf[key];
                if (queryObject.query) {
                    const queryString = createFieldQuery(queryObject.query);
                    dbQueries.push(`(${queryString})`);
                }
            }
            else {
                dbQueries.push(`"${fieldKey}" = ${escapeQueryValue(queryValue)}`);
            }
        }

    })

    const listFieldsString = listFields.map(field => `"${field}"`).join(', ');

    const dbQueryString = `select ${listFieldsString} from ${model.dbTable || model.name} ${dbQueries.length > 0 ? `where ${dbQueries.join(' AND ')}` : ''} limit ${perPage} offset ${offset}`;
    const countQueryString = `select count(*) from ${model.dbTable || model.name} ${dbQueries.length > 0 ? `where ${dbQueries.join(' AND ')}` : ''}`;


    let result, countResult;
    try {
        result = await executeQuery(dbQueryString);

    } catch (error) {
        throw new Error((error as Error).message);
    }

    try {
        countResult = await executeQuery(countQueryString);
    } catch (error) {
        throw new Error((error as Error).message);
    }

    return {

        data: result.rows,
        total: countResult.rows[0].count,
        resultCount: result.rowCount,
    };
}


/**
     * queryObject = { someField: {gte: 10},
        someNameField: {contains: "John"},
        AND: [
            {date: {gte: 10}},
            {date: {lte: 20}},
        ]
}
     */
function createFieldQuery(queryObject: Record<string, any>): string {

    const queryStrings = Object.keys(queryObject).map(key => {

        if (key === 'AND' || key === 'OR') {


            const nestedStrings = (queryObject[key] as Record<string, any>[]).map(queryItem => {
                return createFieldQuery(queryItem);
            });
            return nestedStrings.join(` ${key} `);
        }
        else {
            const queryValue = queryObject[key];
            if (typeof queryValue === "object") {

                return Object.keys(queryValue).map(operator => {
                    switch (operator) {
                        case 'gte':
                            return `"${key}" >= ${escapeQueryValue(queryValue[operator])}`;
                        case 'lte':
                            return `"${key}" <= ${escapeQueryValue(queryValue[operator])}`;
                        case 'contains':
                            return `"${key}" LIKE ${escapeQueryValue(queryValue[operator])}`;
                    }
                }).join(' AND ');
            } else {
                return `${key} = ${escapeQueryValue(queryValue)}`;
            }
        }
    });
    return queryStrings.join(' AND ');
}
