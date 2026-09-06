export interface ModelField {
  id: string;
  name: string;
  type: string;
  primaryKey?: boolean;
  autoIncrement?: boolean;
  required?: boolean;
  autoInsert?: boolean;
}

export interface Model {
  name: string;
  fields: ModelField[];
  dbTable?: string;
  description?: string;
}

export type QueryModelFunction<T = any> = (
  props: QueryModelProps,
) => Promise<QueryModelResult<T>>;

export type GetModelByIdFunctionProps = {
  model: Model;
  id: string | number;
  listFields: string[];
};
export type GetModelByIdFunction<T = Record<string, any>> = (
  props: GetModelByIdFunctionProps,
) => Promise<T>;

export interface DeleteResult {
  success: boolean;
  errors?: Record<string, string>;
  error?: string;
}

export type DeleteModelFunctionProps = {
  model: Model;
  id: string | number;
};
export type DeleteModelFunction = (
  props: DeleteModelFunctionProps,
) => Promise<DeleteResult>;

export type UpdateModelFunctionProps = {
  model: Model;
  id: string | number;
  data: Record<string, unknown>;
};
export type UpdateModelFunction = (
  props: UpdateModelFunctionProps,
) => Promise<undefined>;

export type SaveModelFunctionProps<T = Record<string, any>> = {
  model: Model;
  data: T;
};
export type SaveModelFunction = <T = Record<string, any>>(
  props: SaveModelFunctionProps<T>,
) => Promise<T>;

export type DBObject = {
  queryModel: QueryModelFunction;
  getModelById: GetModelByIdFunction;
  deleteModel: DeleteModelFunction;
  updateModel: UpdateModelFunction;
  saveModel: SaveModelFunction;
};

/**
 * {fieldName: 'some Value', field2: {gte: 10}, AND: [{}]}
 */

export type FieldName = string;
export type QueryValue = string | number | boolean | null | Date;

/**
 * A field condition expressed as operators. Comparison operators accept the
 * broad `QueryValue` because values arriving from the URL are always strings
 * (Postgres casts them); programmatic callers may still pass numbers/Dates.
 * `contains` is substring search; `is_null`/`is_not_null` are value-less flags.
 */
export type QueryValueWithOperator = {
  eq?: QueryValue;
  ne?: QueryValue;
  gt?: QueryValue;
  gte?: QueryValue;
  lt?: QueryValue;
  lte?: QueryValue;
  in?: QueryValue[];
  contains?: string;
  is_null?: boolean;
  is_not_null?: boolean;
};
export type DbOperator = keyof QueryValueWithOperator;

export type QueryValueObject = QueryValueWithOperator | QueryValue;
export type FieldQuery = {
  [fieldName: FieldName]: QueryValueObject;
};
export type ModelFieldQuery =
  | FieldQuery
  | {
      AND?: ModelFieldQuery[];
      OR?: ModelFieldQuery[];
    };

export type QueryModelResult<T> = {
  data: T[];
  total?: number;
  resultCount: number | null;
};

export type QueryModelProps = {
  model: Model;
  listFields?: string[];
  queryFields: ModelFieldQuery;
  limit: number;
  offset: number;
  countTotal?: boolean;
};
