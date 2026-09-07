import { getPostgresClient } from "..";
import { getAppState } from "../../../appState";




export async function executeMigrationFile(
  fileName: string,
  fileQuery: string,
) {
  const appState = getAppState();

  const db = appState.db;
  const client = await getPostgresClient();

  try {
    // execute in transaction

    // transaction query

    const transactionQuery = `
        BEGIN;

        ${fileQuery}

        INSERT INTO migrations (name) VALUES ('${fileName}');

        COMMIT;
    `;
    await client.query(transactionQuery);
    
  } catch (error) {
    await client.query("ROLLBACK;");
    try {
      await db.executeQuery(
        `INSERT INTO migrations (name, failure_reason) VALUES ('${fileName}', '${error}')`,
      );
    } catch (e) {
      // we can miss this since we are throwing error anyway
    }

    throw new Error(`Error executing migration ${fileName}: ${error}`);
  } finally {
    client.release()
  }
}
