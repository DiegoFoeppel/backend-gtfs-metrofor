// Junta os feeds GTFS (metrofor, etufor, arce) num só, prefixando os ids.
// Uso: npx tsx src/scripts/merge-feeds.ts
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { once } from "node:events";
import { parse } from "csv-parse";
import { parse as parseSync } from "csv-parse/sync";
import { stringify } from "csv-stringify";

const FEEDS = ["metrofor", "etufor", "arce"];
const PREFIXED = (feed: string) => (feed === "metrofor" ? null : feed); // Metrofor fica sem prefixo
const IN_DIR = "data";
const OUT_DIR = "data/gtfs_merged";

const ID_COLUMNS: Record<string, string[]> = {
  "agency.txt": ["agency_id"],
  "routes.txt": ["route_id", "agency_id"],
  "trips.txt": ["trip_id", "route_id", "service_id", "shape_id"],
  "stop_times.txt": ["trip_id", "stop_id"],
  "stops.txt": ["stop_id", "parent_station"],
  "calendar.txt": ["service_id"],
  "calendar_dates.txt": ["service_id"],
  "shapes.txt": ["shape_id"],
  "frequencies.txt": ["trip_id"],
};

// colunas que o script cria
const EXTRA_COLUMNS: Record<string, string[]> = {
  "agency.txt": ["agency_id"],
  "routes.txt": ["agency_id", "feed_id"],
  "stops.txt": ["feed_id"],
};

const feedDir = (feed: string) => path.join(IN_DIR, `gtfs_${feed}`);

async function readHeader(file: string): Promise<string[]> {
  const rl = readline.createInterface({ input: fs.createReadStream(file) });
  for await (const line of rl) {
    rl.close();
    return parseSync(line, { bom: true })[0] as string[];
  }
  return [];
}

function transform(file: string, row: Record<string, string>, feed: string) {
  const prefix = PREFIXED(feed);
  for (const col of ID_COLUMNS[file] ?? []) {
    if (row[col] && prefix) row[col] = `${prefix}:${row[col]}`; // vazio continua vazio
  }
  // feeds com uma agência só costumam deixar agency_id vazio
  if ((file === "agency.txt" || file === "routes.txt") && !row.agency_id) {
    row.agency_id = feed;
  }
  if (file === "routes.txt" || file === "stops.txt") row.feed_id = feed;
  return row;
}

async function mergeFile(file: string) {
  const sources = FEEDS.filter((f) =>
    fs.existsSync(path.join(feedDir(f), file)),
  );
  if (sources.length === 0) return;

  // 1ª passada: união das colunas de todos os feeds
  const columns = new Set<string>(EXTRA_COLUMNS[file] ?? []);
  for (const feed of sources) {
    for (const col of await readHeader(path.join(feedDir(feed), file)))
      columns.add(col);
  }

  // 2ª passada: lê, prefixa e escreve
  const out = fs.createWriteStream(path.join(OUT_DIR, file));
  const writer = stringify({ header: true, columns: [...columns] });
  writer.pipe(out);

  let total = 0;
  for (const feed of sources) {
    const parser = fs.createReadStream(path.join(feedDir(feed), file)).pipe(
      parse({
        columns: true,
        bom: true,
        skip_empty_lines: true,
        relax_column_count: true,
      }),
    );

    for await (const row of parser) {
      if (!writer.write(transform(file, row, feed)))
        await once(writer, "drain");
      total++;
    }
  }

  writer.end();
  await once(out, "finish");
  console.log(`${file}: ${total} linhas de ${sources.join(", ")}`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const file of Object.keys(ID_COLUMNS)) await mergeFile(file);
