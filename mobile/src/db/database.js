import { SQLiteConnection, CapacitorSQLite } from '@capacitor-community/sqlite'
import { DB_NAME, DB_VERSION, SCHEMA_SQL } from './schema'

const sqlite = new SQLiteConnection(CapacitorSQLite)
let dbConn = null

// In dev (browser, `npm run dev`) there's no native SQLite — the plugin needs
// the jeep-sqlite web component + wasm to work outside a real device/emulator.
// Real usage (and testing) happens via `npx cap run android`.
export async function initDatabase() {
  if (dbConn) return dbConn

  const consistent = await sqlite.checkConnectionsConsistency()
  const alreadyOpen = (await sqlite.isConnection(DB_NAME, false)).result

  dbConn =
    consistent.result && alreadyOpen
      ? await sqlite.retrieveConnection(DB_NAME, false)
      : await sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false)

  await dbConn.open()
  await dbConn.execute(SCHEMA_SQL)
  return dbConn
}

export function getDB() {
  if (!dbConn) throw new Error('Database non inizializzato — chiama initDatabase() prima')
  return dbConn
}
