import fs from "node:fs";
import { getAppliedSchemaPath } from "./getAppliedSchemaPath";
import { Model } from "../types";

/**
 * The "old" schema is the set of models as of the last applied migration,
 * persisted in `appliedSchema.json`. `makeMigration` diffs the current models
 * (from appConfig) against this. If the file doesn't exist yet (nothing has
 * been migrated), every model is treated as new.
 */
export function readOldModels(): Model[] {
  const appliedSchemaPath = getAppliedSchemaPath();
  if (!fs.existsSync(appliedSchemaPath)) {
    return [];
  }
  const content = fs.readFileSync(appliedSchemaPath, "utf-8");
  const parsed = JSON.parse(content);
  return parsed.models ?? [];
}
