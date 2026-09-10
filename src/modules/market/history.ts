import path from "node:path";
import { randomUUID } from "node:crypto";
import { readJsonFile, updateJsonFile } from "@/lib/local-store/json-file";
import type { MarketItem } from "./types";

export type MarketHistory = {
  id: string; kind: "search" | "hot"; createdAt: string;
  query: { platform: string; keyword?: string; page?: number; date?: string; category?: string };
  items: MarketItem[];
};
const file = () => path.join(process.cwd(), "data", "market-history.local.json");
export async function readMarketHistory() { return readJsonFile<MarketHistory[]>(file(), []); }
export async function saveMarketHistory(kind: MarketHistory["kind"], query: MarketHistory["query"], items: MarketItem[]) {
  const record: MarketHistory = { id: randomUUID(), kind, query, items, createdAt: new Date().toISOString() };
  await updateJsonFile<MarketHistory[]>(file(), [], rows => [record, ...rows].slice(0, 100));
  return record;
}
export async function findSavedMarketItem(id: string) {
  return (await readMarketHistory()).flatMap(row => row.items).find(item => item.id === id);
}
