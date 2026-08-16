import { executeQuery } from "../db/postgres.js";
import { escapeQueryValue } from "./escapeQueryValue.js";

export async function queryModel(model, listFields, queryFields, query) {

    const dbQueries = [];

    const page = query.page || 1;
    const perPage = query.perPage || 10;
    const offset = (page - 1) * perPage;

    Object.keys(query).forEach(key => {

        const queryValue = query[key];

        if (queryFields[key]) {

            if (typeof queryFields[key] === 'boolean') {

                dbQueries.push(`"${key}" = ${escapeQueryValue(queryValue)}`);
            } else {
                const queryObject = queryFields[key];

                const queryString = createFieldQuery(queryObject.query);

                dbQueries.push(`(${queryString})`);

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
        throw new Error(error.message);
    }

    try {
        countResult = await executeQuery(countQueryString);
    } catch (error) {
        throw new Error(error.message);
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
function createFieldQuery(queryObject) {

    const queryStrings = Object.keys(queryObject).map(key => {

        if (key === 'AND' || key === 'OR') {


            const queryStrings = queryObject[key].map(queryItem => {
                return createFieldQuery(queryItem);
            });
            return queryStrings.join(` ${key} `);
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
                });
            } else {
                return `${key} = ${escapeQueryValue(queryValue)}`;
            }
        }
    });
    return queryStrings.join(' AND ');
}
