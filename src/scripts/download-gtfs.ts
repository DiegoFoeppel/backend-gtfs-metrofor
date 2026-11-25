// Baixa o feed GTFS do Metrofor e extrai em data/gtfs_metrofor/.
// Uso: npm run download:gtfs -- [--url <url>] [--dir data/gtfs_metrofor]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { unzipSync } from "fflate";

export const METROFOR_URL = "https://info.metrofor.ce.gov.br/gtfs_file";

export async function downloadGtfs(url: string, dir: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download falhou: HTTP ${res.status} em ${url}`);
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()));

  const names = Object.keys(files).filter((n) => n.endsWith(".txt"));
  if (!names.includes("stops.txt") || !names.includes("stop_times.txt"))
    throw new Error("O zip não parece um feed GTFS (faltam stops/stop_times)");

  fs.mkdirSync(dir, { recursive: true });
  for (const name of names) {
    fs.writeFileSync(path.join(dir, path.basename(name)), files[name]);
  }
  return names;
}

function arg(name: string, fallback: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const dir = path.resolve(arg("dir", "data/gtfs_metrofor"));
  const names = await downloadGtfs(arg("url", METROFOR_URL), dir);
  console.log(`${names.length} arquivos extraídos em ${dir}:`);
  console.log(names.join(", "));
}
