import { Model, ModelField } from "../../types";

/**
 * A single reversible migration step. `up` transforms old -> new; `down` is its
 * exact inverse. The whole migration's `down` is the steps applied in REVERSE
 * order, so operations undo in the opposite order they were applied. Every
 * statement references the *new* table/column names, because during a down run
 * the schema is still in its "new" shape until the final rename-back steps
 * (which, being first in `up`, end up last in the reversed `down`).
 */
type Step = { up: string; down: string };

export function getModelMigrationQueries(
  oldModels: Model[],
  newModels: Model[],
) {
  const steps: Step[] = [];
  for (const model of newModels) {
    const oldModel = oldModels.find((m) => m.id === model.id);
    if (oldModel) {
      steps.push(...migrateModel(oldModel, model));
    } else {
      steps.push(...addNewModel(model));
    }
  }
  return {
    up: steps.map((s) => s.up),
    // reverse so the migration undoes in the opposite order it was applied
    down: steps
      .slice()
      .reverse()
      .map((s) => s.down),
  };
}

function indexName(table: string, column: string): string {
  return `idx_${table}_${column}`;
}

function migrateModel(oldModel: Model, newModel: Model): Step[] {
  const steps: Step[] = [];
  const table = newModel.dbTable ?? newModel.name;

  // Rename the table first on `up`; on the reversed `down` this becomes the
  // very last step, after every column op has been undone on the new table.
  if (oldModel.name !== newModel.name) {
    steps.push({
      up: `ALTER TABLE ${oldModel.dbTable} RENAME TO ${newModel.dbTable};`,
      down: `ALTER TABLE ${newModel.dbTable} RENAME TO ${oldModel.dbTable};`,
    });
  }

  for (const field of newModel.fields) {
    const oldField = oldModel.fields.find((f) => f.id === field.id);

    if (!oldField) {
      steps.push(...addColumn(table, field));
      continue;
    }

    // Rename the column first on `up`; last-per-column on the reversed `down`.
    if (oldField.name !== field.name) {
      steps.push({
        up: `ALTER TABLE ${table} RENAME COLUMN ${oldField.name} TO ${field.name};`,
        down: `ALTER TABLE ${table} RENAME COLUMN ${field.name} TO ${oldField.name};`,
      });
    }

    if (oldField.type !== field.type) {
      steps.push({
        up: `ALTER TABLE ${table} ALTER COLUMN ${field.name} TYPE ${field.type};`,
        down: `ALTER TABLE ${table} ALTER COLUMN ${field.name} TYPE ${oldField.type};`,
      });
    }

    if (Boolean(oldField.required) !== Boolean(field.required)) {
      steps.push({
        up: `ALTER TABLE ${table} ALTER COLUMN ${field.name} ${field.required ? "SET" : "DROP"} NOT NULL;`,
        down: `ALTER TABLE ${table} ALTER COLUMN ${field.name} ${field.required ? "DROP" : "SET"} NOT NULL;`,
      });
    }

    if (Boolean(oldField.index) !== Boolean(field.index)) {
      const create = `CREATE INDEX ${indexName(table, field.name)} ON ${table} (${field.name});`;
      const drop = `DROP INDEX ${indexName(table, field.name)};`;
      steps.push(
        field.index ? { up: create, down: drop } : { up: drop, down: create },
      );
    }

    if (oldField.defaultValue !== field.defaultValue) {
      steps.push({
        up: setDefaultSql(table, field.name, field.defaultValue),
        down: setDefaultSql(table, field.name, oldField.defaultValue),
      });
    }

    if (Boolean(oldField.primaryKey) !== Boolean(field.primaryKey)) {
      const add = `ALTER TABLE ${table} ADD PRIMARY KEY (${field.name});`;
      const drop = `ALTER TABLE ${table} DROP CONSTRAINT ${table}_pkey;`;
      steps.push(
        field.primaryKey ? { up: add, down: drop } : { up: drop, down: add },
      );
    }
  }

  return steps;
}

/** ADD COLUMN (+ its index, as a separate step so it reverses cleanly). */
function addColumn(table: string, field: ModelField): Step[] {
  if (field.required && field.defaultValue === undefined) {
    throw new Error(
      `Field ${field.name} is required but has no default value.`,
    );
  }

  let up = `ALTER TABLE ${table} ADD COLUMN ${field.name} ${field.type}`;
  if (field.defaultValue !== undefined) up += ` DEFAULT ${field.defaultValue}`;
  if (field.required) up += " NOT NULL";
  if (field.primaryKey) up += " PRIMARY KEY";
  up += ";";

  const steps: Step[] = [
    { up, down: `ALTER TABLE ${table} DROP COLUMN ${field.name};` },
  ];

  if (field.index) {
    steps.push({
      up: `CREATE INDEX ${indexName(table, field.name)} ON ${table} (${field.name});`,
      down: `DROP INDEX ${indexName(table, field.name)};`,
    });
  }

  return steps;
}

/** SET DEFAULT to a value, or DROP DEFAULT when the value is undefined. */
function setDefaultSql(
  table: string,
  column: string,
  value: unknown,
): string {
  return value !== undefined
    ? `ALTER TABLE ${table} ALTER COLUMN ${column} SET DEFAULT ${value};`
    : `ALTER TABLE ${table} ALTER COLUMN ${column} DROP DEFAULT;`;
}

function addNewModel(model: Model): Step[] {
  const columns = model.fields
    .map((field) => {
      let col = `${field.name} ${field.type}`;
      if (field.defaultValue !== undefined) col += ` DEFAULT ${field.defaultValue}`;
      if (field.required) col += " NOT NULL";
      if (field.primaryKey) col += " PRIMARY KEY";
      return col;
    })
    .join(", ");
  return [
    {
      up: `CREATE TABLE ${model.dbTable} (${columns});`,
      down: `DROP TABLE ${model.dbTable};`,
    },
  ];
}
