import { getAppState } from "../../../appState";

export async function getAllMigrations() {
  const appState = getAppState();

  const db = appState.db;

  const query = `SELECT * FROM migrations ORDER BY created_at DESC;`;

  try {
    const result = await db.executeQuery(query);

    const map = new Map();

    result.rows?.forEach((row) => {
      map.set(row.name, row);
    });

    return map;
  } catch (error) {
    throw new Error(`Error fetching migrations: ${error}`);
  }
}
