// Exporta o feed do Postgres para um arquivo SQLite que o app mobile embarca.
// Uso: npm run export:sqlite -- [--out caminho/metrofor.db]
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import pg from "pg";

const SCHEMA = process.env.GTFS_SCHEMA ?? "gtfs_metrofor";
export const SCHEMA_VERSION = 1;

// "HH:MM:SS" (aceita 24h+) -> segundos desde a meia-noite
export function toSeconds(time: string | null | undefined): number | null {
  if (!time) return null;
  const [h, m, s] = time.split(":").map(Number);
  if ([h, m, s].some((n) => Number.isNaN(n))) return null;
  return h * 3600 + m * 60 + s;
}

const DDL = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE cities (city_id TEXT PRIMARY KEY, city_name TEXT NOT NULL);
CREATE TABLE routes (
  route_id TEXT PRIMARY KEY, city_id TEXT, route_short_name TEXT,
  route_long_name TEXT, route_desc TEXT, route_type INTEGER NOT NULL,
  route_color TEXT, route_text_color TEXT
);
CREATE TABLE stops (
  stop_id TEXT PRIMARY KEY, stop_code TEXT, stop_name TEXT,
  stop_lat REAL, stop_lon REAL, parent_station TEXT
);
CREATE TABLE calendar (
  service_id TEXT PRIMARY KEY,
  monday INTEGER, tuesday INTEGER, wednesday INTEGER, thursday INTEGER,
  friday INTEGER, saturday INTEGER, sunday INTEGER,
  start_date TEXT, end_date TEXT
);
CREATE TABLE trips (
  trip_id TEXT PRIMARY KEY, route_id TEXT, service_id TEXT,
  trip_headsign TEXT, direction_id INTEGER
);
-- horários em texto (HH:MM:SS) e em segundos, já que o GTFS passa de 24h
CREATE TABLE stop_times (
  trip_id TEXT NOT NULL, stop_sequence INTEGER NOT NULL, stop_id TEXT NOT NULL,
  arrival_time TEXT, departure_time TEXT,
  arrival_sec INTEGER, departure_sec INTEGER,
  PRIMARY KEY (trip_id, stop_sequence)
) WITHOUT ROWID;
CREATE INDEX idx_trips_route_dir ON trips (route_id, direction_id);
CREATE INDEX idx_stop_times_stop ON stop_times (stop_id, trip_id);
`;

type Row = Record<string, unknown>;

function insertAll(
  sqlite: DatabaseSync,
  table: string,
  columns: string[],
  rows: unknown[][],
) {
  const stmt = sqlite.prepare(
    `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
  );
  sqlite.exec("BEGIN");
  try {
    for (const r of rows) stmt.run(...(r as never[]));
    sqlite.exec("COMMIT");
  } catch (e) {
    sqlite.exec("ROLLBACK");
    throw e;
  }
}

const trim = (v: unknown) => (typeof v === "string" ? v.trim() : v);

export async function exportSqlite(client: pg.Client, outFile: string) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.rmSync(outFile, { force: true });

  const sqlite = new DatabaseSync(outFile);
  sqlite.exec(DDL);

  const q = async (sql: string) => (await client.query(sql)).rows as Row[];
  const counts: Record<string, number> = {};
  const load = async (
    table: string,
    sql: string,
    columns: string[],
    map: (r: Row) => unknown[] = (r) => columns.map((c) => trim(r[c]) ?? null),
  ) => {
    const rows = (await q(sql)).map(map);
    insertAll(sqlite, table, columns, rows);
    counts[table] = rows.length;
  };

  const S = SCHEMA;
  await load("cities", `SELECT city_id, city_name FROM ${S}.cities`, [
    "city_id",
    "city_name",
  ]);
  await load(
    "routes",
    `SELECT route_id, city_id, route_short_name, route_long_name, route_desc,
            route_type, route_color, route_text_color FROM ${S}.routes`,
    [
      "route_id",
      "city_id",
      "route_short_name",
      "route_long_name",
      "route_desc",
      "route_type",
      "route_color",
      "route_text_color",
    ],
  );
  await load(
    "stops",
    `SELECT stop_id, stop_code, stop_name, stop_lat, stop_lon, parent_station
     FROM ${S}.stops`,
    ["stop_id", "stop_code", "stop_name", "stop_lat", "stop_lon", "parent_station"],
  );
  await load(
    "calendar",
    `SELECT service_id, monday, tuesday, wednesday, thursday, friday, saturday,
            sunday, to_char(start_date, 'YYYY-MM-DD') AS start_date,
            to_char(end_date, 'YYYY-MM-DD') AS end_date FROM ${S}.calendar`,
    [
      "service_id",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
      "start_date",
      "end_date",
    ],
  );
  await load(
    "trips",
    `SELECT trip_id, route_id, service_id, trip_headsign, direction_id
     FROM ${S}.trips`,
    ["trip_id", "route_id", "service_id", "trip_headsign", "direction_id"],
  );
  await load(
    "stop_times",
    `SELECT trip_id, stop_sequence, stop_id, arrival_time, departure_time
     FROM ${S}.stop_times`,
    [
      "trip_id",
      "stop_sequence",
      "stop_id",
      "arrival_time",
      "departure_time",
      "arrival_sec",
      "departure_sec",
    ],
    (r) => [
      r.trip_id,
      r.stop_sequence,
      r.stop_id,
      r.arrival_time ?? null,
      r.departure_time ?? null,
      toSeconds(r.arrival_time as string),
      toSeconds(r.departure_time as string),
    ],
  );

  const meta = sqlite.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
  meta.run("schema_version", String(SCHEMA_VERSION));
  meta.run("generated_at", new Date().toISOString());
  sqlite.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  sqlite.exec("VACUUM");
  sqlite.close();

  return counts;
}

// só roda quando chamado direto (não ao importar nos testes)
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const outArg = process.argv.indexOf("--out");
  const out = path.resolve(
    outArg > -1 ? process.argv[outArg + 1] : "dist/metrofor.db",
  );
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const counts = await exportSqlite(client, out);
    console.log(`SQLite gerado em ${out}`);
    console.table(counts);
  } finally {
    await client.end();
  }
}
