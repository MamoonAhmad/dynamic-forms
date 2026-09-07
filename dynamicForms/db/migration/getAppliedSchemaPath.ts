import { getScriptPath } from "./getScriptPath";

/** Absolute path to the applied-schema snapshot (models as of the last migration). */
export function getAppliedSchemaPath(): string {
  return `${getScriptPath()}/appliedSchema.json`;
}
