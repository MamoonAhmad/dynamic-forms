import { Model, QueryFields, QueryParams } from "../types";

export type QueryModelFunction<T = any> = (
  model: Model,
  listFields: string[],
  queryFields: QueryFields,
  query: QueryParams,
) => Promise<{ data: T[]; total: number | null; resultCount: number | null }>;

export type GetModelByIdFunction<T = Record<string, any>> = (
  model: Model,
  id: string | number,
  listFields: string[],
) => Promise<T>;

export interface DeleteResult {
  success: boolean;
  errors?: Record<string, string>;
  error?: string;
}
export type DeleteModelFunction = (
  model: Model,
  id: string | number,
) => Promise<DeleteResult>;

export type UpdateModelFunction = (
  model: Model,
  id: string | number,
  validatedData: Record<string, unknown>,
) => Promise<undefined>;

export type SaveModelFunction = <T = Record<string, any>>(
  model: Model,
  validatedData: T,
) => Promise<T>;

export type DBObject = {
  queryModel: QueryModelFunction;
  getModelById: GetModelByIdFunction;
  deleteModel: DeleteModelFunction;
  updateModel: UpdateModelFunction;
  saveModel: SaveModelFunction;
};
