import * as cloud from "./db.cloud";
import * as local from "./db.local";
import { isSupabasePersistenceConfigured } from "./supabase/config";

export type { TrackedAccountBundle } from "./db.cloud";

type MarketItemInput = Parameters<typeof cloud.saveMarketItemToDb>[0];
type ProviderCallLogInput = Parameters<typeof cloud.saveProviderCallLog>[0];
type IdeaInput = Parameters<typeof cloud.saveIdeaToDb>[0];

const cloudEnabled = () => isSupabasePersistenceConfigured();

export async function listTrackedAccountBundles() {
  return cloudEnabled() ? cloud.listTrackedAccountBundles() : local.listTrackedAccountBundles();
}
export async function saveTrackedAccountBundle(bundle: cloud.TrackedAccountBundle) {
  return cloudEnabled() ? cloud.saveTrackedAccountBundle(bundle) : local.saveTrackedAccountBundle(bundle);
}
export async function deleteTrackedAccountBundle(id: string) {
  return cloudEnabled() ? cloud.deleteTrackedAccountBundle(id) : local.deleteTrackedAccountBundle(id);
}
export async function saveMarketItemToDb(item: MarketItemInput) {
  return cloudEnabled() ? cloud.saveMarketItemToDb(item) : local.saveMarketItemToDb(item);
}
export async function upsertMarketItemToDb(item: MarketItemInput) {
  return cloudEnabled() ? cloud.upsertMarketItemToDb(item) : local.upsertMarketItemToDb(item);
}
export async function getMarketItemFromDb(id: string) {
  return cloudEnabled() ? cloud.getMarketItemFromDb(id) : local.getMarketItemFromDb(id);
}
export async function listMarketItemsFromDb(filters?: Parameters<typeof cloud.listMarketItemsFromDb>[0]) {
  return cloudEnabled() ? cloud.listMarketItemsFromDb(filters) : local.listMarketItemsFromDb(filters);
}
export async function saveProviderCallLog(log: ProviderCallLogInput) {
  return cloudEnabled() ? cloud.saveProviderCallLog(log) : local.saveProviderCallLog(log);
}
export async function getOperationSummary(days = 7) {
  return cloudEnabled() ? cloud.getOperationSummary(days) : local.getOperationSummary(days);
}
export async function getProviderCache(key: string) {
  return cloudEnabled() ? cloud.getProviderCache(key) : local.getProviderCache(key);
}
export async function setProviderCache(key: string, provider: string, endpoint: string, response: string, statusCode = 200) {
  return cloudEnabled()
    ? cloud.setProviderCache(key, provider, endpoint, response, statusCode)
    : local.setProviderCache(key, provider, endpoint, response, statusCode);
}
export async function cleanupExpiredCache(maxAgeHours = 24) {
  return cloudEnabled() ? cloud.cleanupExpiredCache(maxAgeHours) : local.cleanupExpiredCache(maxAgeHours);
}
export async function saveIdeaToDb(idea: IdeaInput) {
  return cloudEnabled() ? cloud.saveIdeaToDb(idea) : local.saveIdeaToDb(idea);
}
export async function getIdeaFromDb(id: string) {
  return cloudEnabled() ? cloud.getIdeaFromDb(id) : local.getIdeaFromDb(id);
}
export async function listIdeasFromDb(status?: string) {
  return cloudEnabled() ? cloud.listIdeasFromDb(status) : local.listIdeasFromDb(status);
}
export async function updateIdeaStatus(id: string, status: string) {
  return cloudEnabled() ? cloud.updateIdeaStatus(id, status) : local.updateIdeaStatus(id, status);
}
