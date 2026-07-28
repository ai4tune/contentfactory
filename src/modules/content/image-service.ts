import { chatCompletionJson, parseJsonObject } from "@/lib/ai";
import { requireEnv } from "@/lib/config";
import type { AccountContext } from "@/modules/positioning/types";
import type { GeneratedVisualAsset } from "./types";

type ImagePlanItem = Pick<
  GeneratedVisualAsset,
  "kind" | "title" | "body" | "points" | "layout" | "prompt"
>;
type CardLayout = Exclude<NonNullable<GeneratedVisualAsset["layout"]>, "cover">;

type GenerateVisualAssetsInput = {
  topic: string;
  content: string;
  accountContext: AccountContext | null;
};

export async function generateXiaohongshuVisualAssets(
  input: GenerateVisualAssetsInput,
): Promise<GeneratedVisualAsset[]> {
  const [cover, ...cards] = await createImagePlan(input);
  return [
    await generateCoverAsset(cover, 0),
    ...cards.map((item, index) => ({
      id: createAssetId(index + 1),
      ...item,
      status: "generated" as const,
      updatedAt: new Date().toISOString(),
    })),
  ];
}

export async function retryXiaohongshuVisualAsset(
  asset: GeneratedVisualAsset,
): Promise<GeneratedVisualAsset> {
  if (asset.kind !== "cover" || !asset.prompt) {
    throw new Error("只有封面背景需要调用生图服务重新生成。");
  }
  return generateCoverAsset(asset, 0, asset.id);
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
        "你是小红书图文策划和信息设计师。只输出 JSON，不要 Markdown。",
        "JSON 必须包含 items：第 1 项 kind=cover，后面 3–6 项 kind=card。",
        "封面负责吸引点击，包含 title、body 和 prompt。title 不超过 18 个汉字，body 不超过 28 个汉字；prompt 只描述无文字的背景画面、主体、场景、构图和配色，明确禁止画面出现任何文字、字母、数字、水印或品牌标识。",
        "内页负责解释正文，每项包含 title、body、points 和 layout，不需要 prompt。title 不超过 20 个汉字，body 不超过 80 个汉字，points 为 0–5 条短句。",
        "layout 只能是 explain、steps、checklist、summary。连续内页共同构成完整阅读顺序，不要把每页都写成封面或口号。",
        "只使用终稿中已有的事实和观点，不得虚构参数、数据、客户案例或承诺。",
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
        "请制作 1 张点击封面和 3–6 张正文内页。内页按“问题/背景 → 核心解释/步骤 → 清单/总结”组织，让用户右滑后真正读懂正文。",
      ].join("\n\n"),
    },
  ]);
  const parsed = parseJsonObject(raw) as { items?: unknown };
  return normalizeImagePlan(parsed.items, input.topic);
}

function normalizeImagePlan(value: unknown, topic: string): ImagePlanItem[] {
  if (!Array.isArray(value)) throw new Error("AI 没有返回可用的图文方案，请重试。");

  const items: ImagePlanItem[] = [];
  value.slice(0, 7).forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const title = String(record.title ?? "").trim().slice(0, index === 0 ? 28 : 32);
    const body = String(record.body ?? "").trim().slice(0, index === 0 ? 60 : 180);
    if (!title) return;

    if (index === 0) {
      const prompt = String(record.prompt ?? "").trim();
      if (!prompt) return;
      items.push({
        kind: "cover" as const,
        layout: "cover" as const,
        title,
        body,
        prompt: [
          prompt,
          `内容主题：${topic}`,
          "竖版视觉背景，主体明确、画面有吸引力并预留标题区域。画面中绝对不要出现文字、字母、数字、水印、海报排版或品牌标志。",
        ].join("\n"),
      });
      return;
    }

    items.push({
      kind: "card" as const,
      layout: normalizeCardLayout(record.layout, index, value.length),
      title,
      body,
      points: normalizePoints(record.points),
    });
  });

  if (items.length < 4 || items.length > 7 || items[0]?.kind !== "cover") {
    throw new Error("AI 图文方案需要包含 1 张封面和 3–6 张正文内页，请重试。");
  }
  return items;
}

async function generateCoverAsset(
  item: ImagePlanItem,
  index: number,
  existingId?: string,
): Promise<GeneratedVisualAsset> {
  const updatedAt = new Date().toISOString();
  const id = existingId ?? createAssetId(index);

  try {
    if (!item.prompt) throw new Error("封面缺少背景图提示词。");
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
      error: error instanceof Error ? error.message : "封面背景生成失败",
      updatedAt,
    };
  }
}

function createAssetId(index: number) {
  return `xhsImage_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalizePoints(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim().slice(0, 64))
    .filter(Boolean)
    .slice(0, 5);
}

function normalizeCardLayout(
  value: unknown,
  index: number,
  total: number,
): CardLayout {
  if (value === "explain" || value === "steps" || value === "checklist" || value === "summary") {
    return value;
  }
  if (index === total - 1) return "summary";
  return index === 1 ? "explain" : "steps";
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
