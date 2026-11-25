// Importa os arquivos GTFS (.txt) de uma pasta para o Postgres.
// Uso: npm run import:gtfs -- [--dir data/gtfs_metrofor] [--schema gtfs_metrofor] [--dry-run]
//
// - stops, trips, stop_times e calendar são substituídos pelo conteúdo dos arquivos;
// - routes é atualizada por upsert e preserva o city_id (que o GTFS não traz);
// - tudo roda numa transação: se algo falhar, o banco fica como estava.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "csv-parse/sync";
import pg from "pg";

const CHUNK = 1000;

// ordem importa: filhos antes dos pais ao apagar, pais antes dos filhos ao inserir
const REPLACE_TABLES = ["calendar", "stops", "trips", "stop_times"] as const;
const FILES: Record<string, string> = {
  calendar: "calendar.txt",
  stops: "stops.txt",
  trips: "trips.txt",
  stop_times: "stop_times.txt",
  routes: "routes.txt",
};
const ROUTES_KEEP_ON_CONFLICT = ["city_id"]; // não vem do GTFS

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;

export function readCsv(file: string): Record<string, string>[] {
  return parse(fs.readFileSync(file), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
}

async function tableColumns(client: pg.Client, schema: string, table: string) {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2`,
    [schema, table],
  );
  return new Set(rows.map((r) => r.column_name as string));
}

async function insertRows(
  client: pg.Client,
  schema: string,
  table: string,
  columns: string[],
  rows: Record<string, string>[],
  upsertKey?: string,
) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const params: (string | null)[] = [];
    const tuples = chunk.map((row) => {
      const ph = columns.map((c) => {
        params.push(row[c] === "" || row[c] === undefined ? null : row[c]);
        return `$${params.length}`;
      });
      return `(${ph.join(",")})`;
    });

    let conflict = "";
    if (upsertKey) {
      const updates = columns
        .filter((c) => c !== upsertKey && !ROUTES_KEEP_ON_CONFLICT.includes(c))
        .map((c) => `${q(c)} = EXCLUDED.${q(c)}`);
      conflict = `ON CONFLICT (${q(upsertKey)}) DO UPDATE SET ${updates.join(", ")}`;
    }
    await client.query(
      `INSERT INTO ${q(schema)}.${q(table)} (${columns.map(q).join(",")})
       VALUES ${tuples.join(",")} ${conflict}`,
      params,
    );
  }
}

export type ImportResult = Record<string, number>;

export async function importGtfs(
  client: pg.Client,
  dir: string,
  schema: string,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<ImportResult> {
  // lê e valida tudo antes de encostar no banco
  const data: Record<string, Record<string, string>[]> = {};
  for (const [table, file] of Object.entries(FILES)) {
    const p = path.join(dir, file);
    if (!fs.existsSync(p)) {
      if (table === "routes") continue; // opcional
      throw new Error(`Arquivo obrigatório ausente: ${p}`);
    }
    data[table] = readCsv(p);
  }

  const result: ImportResult = {};
  await client.query("BEGIN");
  try {
    if (data.routes) {
      const cols = await tableColumns(client, schema, "routes");
      const columns = Object.keys(data.routes[0] ?? {}).filter((c) => cols.has(c));
      await insertRows(client, schema, "routes", columns, data.routes, "route_id");
      result.routes = data.routes.length;
    }

    // apaga filhos primeiro
    for (const table of [...REPLACE_TABLES].reverse()) {
      await client.query(`DELETE FROM ${q(schema)}.${q(table)}`);
    }
    for (const table of REPLACE_TABLES) {
      const rows = data[table];
      const cols = await tableColumns(client, schema, table);
      const columns = Object.keys(rows[0] ?? {}).filter((c) => cols.has(c));
      await insertRows(client, schema, table, columns, rows);
      result[table] = rows.length;
    }

    await client.query(dryRun ? "ROLLBACK" : "COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  }
  return result;
}

function arg(name: string, fallback: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const dir = path.resolve(arg("dir", "data/gtfs_metrofor"));
  const schema = arg("schema", process.env.GTFS_SCHEMA ?? "gtfs_metrofor");
  const dryRun = process.argv.includes("--dry-run");

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await importGtfs(client, dir, schema, { dryRun });
    console.log(
      dryRun
        ? `Simulação (nada foi gravado) de ${dir} -> ${schema}`
        : `Importado de ${dir} -> ${schema}`,
    );
    console.table(result);
  } finally {
    await client.end();
  }
}
