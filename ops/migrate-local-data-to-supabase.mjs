import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import Database from "better-sqlite3";
import { createClient } from "@supabase/supabase-js";

const confirmed = process.argv.includes("--confirm=MIGRATE");
const replace = process.argv.includes("--replace");
const dataDir = path.resolve(process.env.CONTENT_FACTORY_DATA_DIR || path.join(process.cwd(), "data"));
const url = required("NEXT_PUBLIC_SUPABASE_URL");
const key = process.env.SUPABASE_SECRET_KEY?.trim()
  || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  || required("SUPABASE_SECRET_KEY");
const workspaceId = required("CONTENT_FACTORY_WORKSPACE_ID");
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const stores = await collectStores();
console.log(JSON.stringify({ dataDir, workspaceId, storeKeys: stores.map((item) => item.store_key), mode: confirmed ? "write" : "dry-run" }, null, 2));
if (!confirmed) {
  console.log("Dry run only. Re-run with --confirm=MIGRATE after reviewing the store keys.");
  process.exit(0);
}

const { data: existing, error: existingError } = await supabase
  .from("content_factory_state")
  .select("store_key")
  .eq("workspace_id", workspaceId)
  .in("store_key", stores.map((item) => item.store_key));
if (existingError) throw existingError;
if (existing?.length && !replace) {
  throw new Error(`Cloud state already contains: ${existing.map((item) => item.store_key).join(", ")}. Use --replace only after taking a backup.`);
}

const rows = stores.map((item) => ({ ...item, workspace_id: workspaceId, version: 1, updated_at: new Date().toISOString() }));
const { error } = await supabase.from("content_factory_state").upsert(rows, { onConflict: "workspace_id,store_key" });
if (error) throw error;
console.log(`Migrated ${rows.length} state stores.`);

async function collectStores() {
  const stores = [];
  if (await exists(dataDir)) {
    for (const entry of await readdir(dataDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      stores.push({ store_key: `json:${entry.name}`, payload: JSON.parse(await readFile(path.join(dataDir, entry.name), "utf8")) });
    }
  }

  const databasePath = path.join(dataDir, "contentfactory.db");
  if (await exists(databasePath)) {
    const db = new Database(databasePath, { readonly: true });
    try {
      stores.push({ store_key: "db:market-items", payload: { items: all(db, "market_items") } });
      stores.push({
        store_key: "db:tracked-account-bundles",
        payload: { bundles: all(db, "tracked_accounts").flatMap((row) => row.payload_json ? [JSON.parse(String(row.payload_json))] : []) },
      });
      stores.push({ store_key: "db:provider-call-logs", payload: { logs: all(db, "provider_call_logs") } });
      stores.push({
        store_key: "db:provider-cache",
        payload: { entries: Object.fromEntries(all(db, "provider_cache").map((row) => [String(row.cache_key), row])) },
      });
      stores.push({ store_key: "db:ideas", payload: { ideas: all(db, "ideas") } });
    } finally {
      db.close();
    }
  }
  return stores;
}

function all(db, table) {
  const found = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return found ? db.prepare(`SELECT * FROM ${table}`).all() : [];
}

async function exists(target) {
  try { await access(target); return true; } catch { return false; }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
