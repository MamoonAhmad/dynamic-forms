import { getPostgresClient } from "..";
import { escapeQueryValue } from "../escapeQueryValue";

export async function executeDownMigrationQuery(
  name: string,
  fileQuery: string,
) {
  const client = await getPostgresClient();

  try {
    await client.query(
      `
        BEGIN;

        ${fileQuery}

        DELETE FROM migrations where name = ${escapeQueryValue(name)};

        COMMIT;
      `,
    );
  } catch (e) {
    await client.query("ROLLBACK;");
    throw new Error(`Could not run down migration ${name}: ${e}`);
  } finally {
    client.release();
  }
}
