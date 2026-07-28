import { chatCompletionJson, parseJsonObject } from "@/lib/ai";
import { requireEnv } from "@/lib/config";
import type { AccountContext } from "@/modules/positioning/types";
import type { GeneratedVisualAsset } from "./types";

type ImagePlanItem = Pick<GeneratedVisualAsset, "kind" | "title" | "prompt">;

type GenerateVisualAssetsInput = {
  topic: string;
  content: string;
  accountContext: AccountContext | null;
};

export async function generateXiaohongshuVisualAssets(
  input: GenerateVisualAssetsInput,
): Promise<GeneratedVisualAsset[]> {
  const plan = await createImagePlan(input);
  const assets: GeneratedVisualAsset[] = [];

  for (let index = 0; index < plan.length; index += 2) {
    const batch = await Promise.all(
      plan.slice(index, index + 2).map((item, offset) =>
        generatePlannedAsset(item, index + offset),
      ),
    );
    assets.push(...batch);
  }

  return assets;
}

export async function retryXiaohongshuVisualAsset(
  asset: GeneratedVisualAsset,
): Promise<GeneratedVisualAsset> {
  return generatePlannedAsset(
    { kind: asset.kind, title: asset.title, prompt: asset.prompt },
    0,
    asset.id,
  );
}

export function isAllowedGeneratedImageUrl(value: string) {
  try {
    const url = new URL(value);
    const configuredHost = new URL(requireEnv("IMAGE_BASE_URL")).hostname;
    return (url.protocol === "https:" || url.protocol === "http:")
      && (url.hostname === configuredHost || url.hostname === "img.xingren.me");
  } catch {
    return false;
  }
}

async function createImagePlan(input: GenerateVisualAssetsInput): Promise<ImagePlanItem[]> {
  const raw = await chatCompletionJson([
    {
      role: "system",
      content: [
        "你是小红书图文策划和视觉导演。只输出 JSON，不要 Markdown。",
        "JSON 必须包含 items，且恰好 4 项：第 1 项 kind=cover，后 3 项 kind=card。",
        "每项必须包含 title 和 prompt。prompt 要描述竖版 2:3 构图、视觉主体、配色、版式和需要清晰呈现的简短中文。",
        "四张图视觉风格必须统一，不得虚构产品参数、数据、客户案例或品牌标识。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `【选题】${input.topic}`,
        "【账号定位】",
        input.accountContext ? JSON.stringify(input.accountContext, null, 2) : "暂无已确认定位",
        "【已保存的小红书终稿】",
        input.content.slice(0, 12_000),
        "请制作 1 张封面和 3 张承载核心信息的图文卡片。每张图上的中文尽量控制在 18 字以内。",
      ].join("\n\n"),
    },
  ]);
  const parsed = parseJsonObject(raw) as { items?: unknown };
  return normalizeImagePlan(parsed.items, input.topic);
}

function normalizeImagePlan(value: unknown, topic: string): ImagePlanItem[] {
  if (!Array.isArray(value)) throw new Error("AI 没有返回可用的配图方案，请重试。");

  const items = value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const title = String(record.title ?? "").trim().slice(0, 40);
    const prompt = String(record.prompt ?? "").trim();
    if (!title || !prompt) return [];
    return [{
      kind: index === 0 ? "cover" as const : "card" as const,
      title,
      prompt: [
        prompt,
        `内容主题：${topic}`,
        "竖版 2:3 小红书图文，中文排版清晰、留白充足、适合手机阅读，不使用未提供的品牌标志。",
      ].join("\n"),
    }];
  }).slice(0, 4);

  if (items.length !== 4) throw new Error("AI 配图方案不是完整的 1 张封面和 3 张卡片，请重试。");
  return items;
}

async function generatePlannedAsset(
  item: ImagePlanItem,
  index: number,
  existingId?: string,
): Promise<GeneratedVisualAsset> {
  const updatedAt = new Date().toISOString();
  const id = existingId ?? `xhsImage_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    const result = await requestImage(item.prompt);
    return {
      id,
      ...item,
      status: "generated",
      imageUrl: result.url,
      revisedPrompt: result.revisedPrompt,
      updatedAt,
    };
  } catch (error) {
    return {
      id,
      ...item,
      status: "failed",
      error: error instanceof Error ? error.message : "图片生成失败",
      updatedAt,
    };
  }
}

async function requestImage(prompt: string) {
  const response = await fetch(normalizeImageGenerationUrl(requireEnv("IMAGE_BASE_URL")), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("IMAGE_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: requireEnv("IMAGE_MODEL"),
      prompt,
      n: 1,
      size: process.env.IMAGE_SIZE || "1024x1536",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(180_000),
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`生图服务请求失败：${response.status} ${responseText.slice(0, 240)}`);
  }

  const payload = JSON.parse(responseText) as {
    data?: Array<{ url?: string; revised_prompt?: string }>;
  };
  const imageUrl = payload.data?.[0]?.url;
  if (!imageUrl) throw new Error("生图服务没有返回可保存的图片地址。");

  return {
    url: normalizeGeneratedImageUrl(imageUrl),
    revisedPrompt: payload.data?.[0]?.revised_prompt,
  };
}

function normalizeImageGenerationUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/images/generations")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/images/generations`;
  return `${trimmed}/v1/images/generations`;
}

function normalizeGeneratedImageUrl(value: string) {
  const url = new URL(value);
  if (url.hostname === "img.xingren.me") url.protocol = "https:";
  return url.toString();
}
