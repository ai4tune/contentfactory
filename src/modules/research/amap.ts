import { createHash } from "node:crypto";
import { z } from "zod";
import { readChatStore } from "@/modules/agent/chat/repository";
import { ChatError } from "@/modules/agent/chat/types";
import { listResearch } from "./repository";
import { clean } from "./service";
import type { ResearchRecord, ResearchSource } from "./types";

export const placeSearchSchema = z.object({ query: z.string().trim().min(1).max(80), city: z.string().trim().min(1).max(40) }).strict();
export const nearbySearchSchema = z.object({ centerSourceId: z.string().trim().min(1).max(300), query: z.string().trim().min(1).max(80), radiusMeters: z.union([z.literal(3000), z.literal(5000)]) }).strict();
export const placeDetailSchema = z.object({ sourceId: z.string().trim().min(1).max(300) }).strict();
const limits = ["仅取得高德首批最多8个地点样本，不代表范围内全量门店或竞争强弱。", "地址、分类、评分、人均消费和营业时间可能缺失或滞后，不是实时经营情况；没有完整评价、销量或客流。", "同名和分店需核对；线上账号须另行搜索验证，不把探店作者自动当作门店官方账号。"];
function coordinate(value: unknown) {
  if (typeof value !== "string" || !/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(value)) return undefined;
  const [lng, lat] = value.split(",").map(Number);
  return Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90
    ? `${Number(lng.toFixed(6))},${Number(lat.toFixed(6))}` : undefined;
}
function number(value: unknown, maximum = Number.MAX_SAFE_INTEGER) {
  if ((typeof value !== "string" && typeof value !== "number") || String(value).trim() === "") return undefined;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 && result <= maximum ? result : undefined;
}
async function requestPlaces(endpoint: "text" | "around" | "detail", parameters: Record<string, string>): Promise<unknown[]> {
  const key = process.env.AMAP_API_KEY?.trim();
  if (!key) throw new ChatError("附近门店查询尚未配置，请联系管理员配置高德服务。", 503);
  try {
    const url = new URL(`${process.env.AMAP_BASE_URL || "https://restapi.amap.com"}/v5/place/${endpoint}`);
    url.search = new URLSearchParams({ ...parameters, key, output: "json", show_fields: "business" }).toString();
    const response = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new ChatError("高德查询暂未成功，请稍后继续。", 502);
    const data = await response.json();
    if (data?.status !== "1" || String(data.infocode) !== "10000") throw new ChatError("高德服务未授权、额度受限或查询未成功，请检查服务配置后继续。", 502);
    if (!Array.isArray(data.pois)) throw new ChatError("高德返回格式异常，不能当作没有附近门店。", 502);
    return data.pois.slice(0, 8);
  } catch (error) {
    if (error instanceof ChatError) throw error;
    // Provider errors and URLs can contain the key. Never persist them in chat records.
    throw new ChatError("高德连接或解析未完成，请稍后继续。", 502);
  }
}
function source(id: string, row: unknown, retrievedAt: string): ResearchSource | undefined {
  if (!row || typeof row !== "object") return undefined;
  const value = row as Record<string, unknown>;
  const location = coordinate(value.location), poiId = clean(value.id, 80), title = clean(value.name, 200);
  if (!location || !/^[a-zA-Z0-9_-]{1,80}$/.test(poiId) || !title) return undefined;
  const business = value.business && typeof value.business === "object" ? value.business as Record<string, unknown> : {};
  // Amap's business.cost has other meanings for buildings. Only documented consumer categories apply.
  const category = clean(value.type, 200);
  const consumptionCategory = /餐饮服务|住宿服务|风景名胜|影剧院|电影院/.test(category);
  const place = { poiId, location, address: clean(value.address, 300), city: clean(value.cityname, 80), district: clean(value.adname, 80), category,
    distanceMeters: number(value.distance), rating: consumptionCategory ? number(business.rating, 5) : undefined, cost: consumptionCategory ? number(business.cost) : undefined,
    businessArea: clean(business.business_area, 200) || undefined, openingHours: clean(business.opentime_week || business.opentime_today, 500) || undefined };
  const url = new URL("https://uri.amap.com/marker");
  url.search = new URLSearchParams({ position: location, name: title, coordinate: "gaode", callnative: "0", src: "xiaozhanggui" }).toString();
  return { id: `${id}:source:${createHash("sha256").update(poiId).digest("hex").slice(0, 20)}`, title, url: url.toString(),
    text: [`地址：${place.city}${place.district}${place.address || "未提供"}`, `分类：${place.category || "未提供"}`,
      `距调研中心：${place.distanceMeters === undefined ? "未提供" : `${place.distanceMeters}米`}`, consumptionCategory ? `高德评分：${place.rating ?? "未知"}；人均消费：${place.cost === undefined ? "未知" : `${place.cost}元`}` : "评分与消费参考：此类地点不适用",
      `商圈：${place.businessArea || "未提供"}`, `营业时间：${place.openingHours || "未提供"}`].join("\n"),
    provider: "amap", evidence: "place", retrievedAt, place };
}
function result(id: string, kind: ResearchRecord["kind"], query: ResearchRecord["query"], rows: unknown[]): ResearchRecord {
  const retrievedAt = new Date().toISOString();
  const sources: ResearchSource[] = [];
  for (const row of rows) {
    const item = source(id, row, retrievedAt);
    if (item && !sources.some((saved) => saved.place!.poiId === item.place!.poiId)) sources.push(item);
  }
  if (rows.length && !sources.length) throw new ChatError("高德未返回可核对的地点或坐标，请调整查询后继续。", 502);
  return { id, kind, query, retrievedAt, sources, limitations: [...limits, ...(rows.length > sources.length ? ["已排除重复地点或缺少有效名称、标识和坐标的记录。"] : [])] };
}
export async function searchPlaces(id: string, input: z.infer<typeof placeSearchSchema>) {
  return result(id, "place_search", input, await requestPlaces("text", { keywords: input.query, region: input.city, city_limit: "true", page_size: "8", page_num: "1" }));
}
// GCJ-02 coordinates also bound returned samples when the provider omits a distance.
function distance(a: string, b: string) {
  const [lngA, latA] = a.split(",").map(Number), [lngB, latB] = b.split(",").map(Number), rad = Math.PI / 180;
  const h = Math.sin((latB - latA) * rad / 2) ** 2 + Math.cos(latA * rad) * Math.cos(latB * rad) * Math.sin((lngB - lngA) * rad / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export async function searchNearbyPlaces(id: string, input: z.infer<typeof nearbySearchSchema>) {
  const center = (await readChatStore()).researchLocation;
  if (!center || center.sourceId !== input.centerSourceId) throw new ChatError("请先在地点来源卡片中确认调研中心；AI 不能自行选定或更换地点。", 409);
  const record = result(id, "nearby_places", { ...input, center }, await requestPlaces("around", { keywords: input.query, location: center.place.location, radius: String(input.radiusMeters), sortrule: "weight", page_size: "8", page_num: "1" }));
  record.sources = record.sources.filter((item) => distance(center.place.location, item.place!.location) <= input.radiusMeters
    && (item.place!.distanceMeters === undefined || item.place!.distanceMeters <= input.radiusMeters));
  record.sources.sort((a, b) => (a.place!.distanceMeters ?? Infinity) - (b.place!.distanceMeters ?? Infinity));
  record.limitations.push("半径是以已确认地点为中心的圆形范围，不是驾车距离；仅对返回样本按已知距离排序，不是最近门店全量排名。未提供距离时仅以坐标检查范围，距离保持未知。");
  return record;
}
export async function readPlace(id: string, input: z.infer<typeof placeDetailSchema>) {
  const recordOwner = (await listResearch()).find((record) => input.sourceId.startsWith(`${record.id}:source:`));
  if (!recordOwner) throw new ChatError("当前账号没有这个高德来源，请先读取自己的调研记录。", 404);
  const selected = recordOwner.sources.find((source) => source.id === input.sourceId);
  if (!selected) throw new ChatError("地点来源暂未匹配。请先读取这次调研的完整来源再继续，不能使用列表序号或猜测编号。", 400);
  if (selected?.provider !== "amap" || !selected.place) throw new ChatError("请使用当前账号已查询的高德地点来源，不能猜测地点标识。", 404);
  const rows = await requestPlaces("detail", { id: selected.place.poiId });
  const record = result(id, "place_detail", input, rows);
  if (record.sources.some((item) => item.place!.poiId !== selected.place!.poiId)) throw new ChatError("高德返回了其他地点，未将其当作所选门店的详情。", 502);
  return record;
}
