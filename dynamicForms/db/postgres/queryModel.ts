import { executeQuery } from ".";
import { escapeQueryValue, escapeIdentifier } from "./escapeQueryValue";
import {
  FieldName,
  FieldQuery,
  ModelFieldQuery,
  QueryModelProps,
  QueryModelResult,
  QueryValueObject,
  QueryValueWithOperator,
} from "../types";

type IsModelFieldFunction = (fieldName: string) => boolean;

export async function queryModel<T = unknown>(
  props: QueryModelProps,
): Promise<QueryModelResult<T>> {
  const { model, listFields = [], queryFields, limit, offset, countTotal } = props;
  const modelFieldNameMap = new Set<string>();
  model.fields.forEach((field) => {
    modelFieldNameMap.add(field.name);
  });
  const isModelField: IsModelFieldFunction = (fieldName: string): boolean => {
    return modelFieldNameMap.has(fieldName);
  };

  listFields.forEach((field) => {
    if (!isModelField(field)) {
      throw new Error(`Invalid model field name: ${field}`);
    }
  });

  const queryFilter = processModelFieldQuery(queryFields, isModelField);

  const fieldNames = listFields.length > 0 ? listFields.map((field) => escapeIdentifier(field)).join(", ") : "*";

  let query = `SELECT ${fieldNames} FROM ${escapeIdentifier(model.dbTable || model.name)}`;
  if (queryFilter) {
    query += ` WHERE ${queryFilter}`;
  }

  if (limit) {
    query += ` LIMIT ${limit}`;
  }
  if (offset) {
    query += ` OFFSET ${offset}`;
  }

  let result, countResult;
  try {
    result = await executeQuery(query);
  } catch (error) {
    throw new Error((error as Error).message);
  }

  if (countTotal) {
    try {
      const countQuery = `SELECT COUNT(*) FROM ${escapeIdentifier(model.dbTable || model.name)}${queryFilter ? ` WHERE ${queryFilter}` : ""}`;
      countResult = await executeQuery(countQuery);
    } catch (error) {
      throw new Error((error as Error).message);
    }
  }

  const queryModelResult: QueryModelResult<T> = {
    data: result.rows,
    resultCount: result.rowCount,
  };
  if (countResult) {
    queryModelResult.total = parseInt(countResult.rows[0].count, 10);
  }

  return queryModelResult;
}

const processModelFieldQuery = (
  query: ModelFieldQuery,
  isModelField: IsModelFieldFunction,
): string => {
  const queryStrings = Object.keys(query).map((fieldName: string) => {
    switch (fieldName) {
      case "AND":
        const andQueries = (query[fieldName] as ModelFieldQuery[]).map(
          (subQuery: ModelFieldQuery) => {
            return processModelFieldQuery(subQuery, isModelField);
          },
        );
        return `(${andQueries.join(" AND ")})`;
      case "OR":
        const orQueries = (query[fieldName] as ModelFieldQuery[]).map(
          (subQuery: ModelFieldQuery) => {
            return processModelFieldQuery(subQuery, isModelField);
          },
        );
        return `(${orQueries.join(" OR ")})`;
      default:
        if (!isModelField(fieldName)) {
          throw new Error(`Invalid model field name: ${fieldName}`);
        }
        const queryValue = (query as FieldQuery)[fieldName];
        return processFieldQuery(fieldName, queryValue);
    }
  });
  return queryStrings.join(" AND ");
};

const processFieldQuery = (
  fieldName: FieldName,
  queryValue: QueryValueObject,
) => {
  if (typeof queryValue === "object" && !(queryValue instanceof Date)) {
    const queryValueWithOperator: QueryValueWithOperator = queryValue!;
    const column = escapeIdentifier(fieldName);
    const innerQueries = Object.keys(queryValueWithOperator).map((operator) => {
      switch (operator) {
        case "gte":
          return `${column} >= ${escapeQueryValue(queryValueWithOperator[operator])}`;
        case "lte":
          return `${column} <= ${escapeQueryValue(queryValueWithOperator[operator])}`;
        case "eq":
          return `${column} = ${escapeQueryValue(queryValueWithOperator[operator])}`;
        case "ne":
          return `${column} != ${escapeQueryValue(queryValueWithOperator[operator])}`;
        case "gt":
          return `${column} > ${escapeQueryValue(queryValueWithOperator[operator])}`;
        case "lt":
          return `${column} < ${escapeQueryValue(queryValueWithOperator[operator])}`;
        case "contains":
          return `${column} ILIKE ${escapeQueryValue(`%${queryValueWithOperator[operator]}%`)}`;
        case "is_null":
          return `${column} IS NULL`;
        case "is_not_null":
          return `${column} IS NOT NULL`;
        case "in": {
          const inValues = (
            queryValueWithOperator[operator] as QueryValueObject[]
          )
            .map((value) => escapeQueryValue(value))
            .join(", ");
          return `${column} IN (${inValues})`;
        }
        default:
          throw new Error(`Invalid operator: ${operator}`);
      }
    });
    if (innerQueries.length > 1) {
      return `(${innerQueries.join(" AND ")})`;
    } else {
      return innerQueries[0];
    }
  }
  return `${escapeIdentifier(fieldName)} = ${escapeQueryValue(queryValue)}`;
};
