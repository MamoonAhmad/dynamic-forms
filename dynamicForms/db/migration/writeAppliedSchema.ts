import fs from "node:fs";
import { getAppliedSchemaPath } from "./getAppliedSchemaPath";
import { Model } from "../types";

/**
 * Persist the current models as the applied schema. Called after migrations are
 * applied so the next `makeMigration` diffs against the just-applied state.
 * The file contains only the models array.
 */
export function writeAppliedSchema(models: Model[]): void {
  const appliedSchemaPath = getAppliedSchemaPath();
  fs.writeFileSync(appliedSchemaPath, JSON.stringify({ models }, null, 2));
}
