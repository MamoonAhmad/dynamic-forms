import { executeQuery } from ".";
import { escapeQueryValue, escapeIdentifier } from "./escapeQueryValue";
import type { Model, QueryFields, QueryParams } from "../../types";

// Query-string keys that control pagination rather than filtering. They must
// never be treated as model fields.
const RESERVED_QUERY_KEYS = new Set(["page", "perPage"]);

export async function queryModel<T = unknown>(
    model: Model,
    listFields: string[],
    queryFields: QueryFields,
    query: QueryParams
): Promise<{ data: T[]; total: number; resultCount: number | null }> {

    // The query-field config is accessed in several dynamic shapes (boolean,
    // operator maps, custom query objects); treat it loosely here.
    const qf = queryFields as Record<string, any>;

    const dbQueries: string[] = [];

    const page = Number(query.page) || 1;
    const perPage = Number(query.perPage) || 10;
    const offset = (page - 1) * perPage;

    // Whitelist of real columns on this model. Any field key coming from the
    // request is validated against this set before being used as a SQL
    // identifier. This is the primary defense against identifier SQL injection
    // (a request key like `id"=1 OR "1"="1` can no longer reach the query) and
    // against filtering on columns that were never exposed via queryFields.
    const modelFieldNames = new Set(model.fields.map((field) => field.name));

    Object.keys(query).forEach(key => {

        if (RESERVED_QUERY_KEYS.has(key)) {
            return;
        }

        const queryValue = query[key];

        let fieldKey = key;
        let operator: string | undefined;
        if (key.includes('__')) {
            [fieldKey, operator] = key.split('__');
        }

        // A custom query is configured under the raw key (not necessarily a
        // model column), e.g. { someFilter: { query: {...} } }.
        const isCustomQuery =
            qf?.[key] && typeof qf[key] === 'object' && 'query' in qf[key];

        // Reject anything that is neither a real model column nor a configured
        // custom query. This closes the identifier-injection and
        // column-enumeration holes.
        if (!modelFieldNames.has(fieldKey) && !isCustomQuery) {
            throw new Error(`Invalid query parameter: ${key}`);
        }

        // `false` disables the field entirely.
        if (qf[fieldKey] === false) {
            throw new Error(`Invalid query parameter: ${key}`);
        }

        if (operator) {
            // An operator must not be explicitly disabled in the config.
            if (qf?.[fieldKey]?.[operator] === false) {
                throw new Error(`Invalid query parameter: ${key}`);
            }

            const column = escapeIdentifier(fieldKey);
            if (queryValue) {
                switch (operator) {
                    case 'lte':
                        dbQueries.push(`${column} <= ${escapeQueryValue(queryValue)}`);
                        break;
                    case 'gte':
                        dbQueries.push(`${column} >= ${escapeQueryValue(queryValue)}`);
                        break;
                    case 'lt':
                        dbQueries.push(`${column} < ${escapeQueryValue(queryValue)}`);
                        break;
                    case 'gt':
                        dbQueries.push(`${column} > ${escapeQueryValue(queryValue)}`);
                        break;
                    case 'is_null':
                        dbQueries.push(`${column} IS NULL`);
                        break;
                    case 'is_not_null':
                        dbQueries.push(`${column} IS NOT NULL`);
                        break;
                    case 'contains':
                        dbQueries.push(`${column} ILIKE ${escapeQueryValue(`%${queryValue}%`)}`);
                        break;
                    default:
                        throw new Error(`Invalid operator: ${operator}`);
                }
            }
        } else if (isCustomQuery) {
            // custom query object defined in the config
            const queryString = createFieldQuery(qf[key].query);
            dbQueries.push(`(${queryString})`);
        } else {
            // plain equality against a validated model column
            dbQueries.push(`${escapeIdentifier(fieldKey)} = ${escapeQueryValue(queryValue)}`);
        }

    })

    const tableName = escapeIdentifier(model.dbTable || model.name);
    const listFieldsString = listFields.map(field => escapeIdentifier(field)).join(', ');
    const whereClause = dbQueries.length > 0 ? `where ${dbQueries.join(' AND ')}` : '';

    const dbQueryString = `select ${listFieldsString} from ${tableName} ${whereClause} limit ${perPage} offset ${offset}`;
    const countQueryString = `select count(*) from ${tableName} ${whereClause}`;


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
                            return `${escapeIdentifier(key)} >= ${escapeQueryValue(queryValue[operator])}`;
                        case 'lte':
                            return `${escapeIdentifier(key)} <= ${escapeQueryValue(queryValue[operator])}`;
                        case 'contains':
                            return `${escapeIdentifier(key)} LIKE ${escapeQueryValue(queryValue[operator])}`;
                    }
                }).join(' AND ');
            } else {
                return `${escapeIdentifier(key)} = ${escapeQueryValue(queryValue)}`;
            }
        }
    });
    return queryStrings.join(' AND ');
}
