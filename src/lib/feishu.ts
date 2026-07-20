import { requireEnv } from "./config";

const FEISHU_API_BASE = "https://open.feishu.cn/open-apis";

export type KnowledgeSource = {
  id: string;
  title: string;
  url?: string;
  source: "feishu" | "base" | "upload";
  text?: string;
};

type FeishuErrorPayload = {
  code?: number;
  msg?: string;
  error?: string;
};

class FeishuError extends Error {
  constructor(
    message: string,
    readonly payload?: FeishuErrorPayload,
  ) {
    super(message);
  }
}

async function feishuFetch<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const token = init.token ?? (await getTenantAccessToken());
  const headers = new Headers(init.headers);

  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json; charset=utf-8");

  const response = await fetch(`${FEISHU_API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as FeishuErrorPayload & T;

  if (!response.ok || (typeof payload.code === "number" && payload.code !== 0)) {
    throw new FeishuError(formatFeishuError(`Feishu API failed: ${path}`, payload), payload);
  }

  return payload as T;
}

export async function getTenantAccessToken(): Promise<string> {
  const payload = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      app_id: requireEnv("FEISHU_APP_ID"),
      app_secret: requireEnv("FEISHU_APP_SECRET"),
    }),
    cache: "no-store",
  }).then((response) => response.json() as Promise<{ code?: number; msg?: string; tenant_access_token?: string }>);

  if (payload.code !== 0 || !payload.tenant_access_token) {
    throw new FeishuError(formatFeishuError("Unable to get Feishu tenant access token", payload), payload);
  }

  return payload.tenant_access_token;
}

export async function searchFeishuDocuments(query: string): Promise<KnowledgeSource[]> {
  const trimmed = query.trim();

  if (!trimmed) {
    return [];
  }

  const payload = await feishuFetch<Record<string, unknown>>("/search/v2/doc_wiki/search", {
    method: "POST",
    body: JSON.stringify({
      query: trimmed,
      count: 10,
      offset: 0,
    }),
  });

  return extractSearchItems(payload).slice(0, 10);
}

export async function readFeishuDocument(documentId: string): Promise<KnowledgeSource> {
  const id = decodeURIComponent(documentId);
  const raw = await tryReadRawContent(id);

  return {
    id,
    title: raw.title || id,
    source: "feishu",
    text: raw.text,
    url: raw.url,
  };
}

export async function resolveFeishuUrl(url: string): Promise<KnowledgeSource> {
  const parsed = parseFeishuUrl(url);

  if (parsed.type === "docx") {
    return readFeishuDocument(parsed.documentId);
  }

  return readBitable(parsed.appToken, parsed.tableId, parsed.viewId);
}

async function readBitable(
  appToken: string,
  tableId?: string,
  viewId?: string,
): Promise<KnowledgeSource> {
  const appPayload = await feishuFetch<Record<string, unknown>>(
    `/bitable/v1/apps/${encodeURIComponent(appToken)}`,
    { method: "GET" },
  );
  const app = readObject(readObject(appPayload.data)?.app);
  const appName = pickString(app ?? {}, ["name"]) ?? appToken;
  const resolvedTableId = tableId ?? (await readFirstTableId(appToken));

  if (!resolvedTableId) {
    return {
      id: appToken,
      title: appName,
      source: "base",
      text: "多维表格可访问，但没有找到可读取的数据表。",
    };
  }

  const fieldsPayload = await feishuFetch<Record<string, unknown>>(
    `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(
      resolvedTableId,
    )}/fields?page_size=100`,
    { method: "GET" },
  );
  const fieldNames = findArray(fieldsPayload, ["items"])
    .map((item) => pickString(readObject(item) ?? {}, ["field_name"]))
    .filter((name): name is string => Boolean(name));
  const recordsPath =
    `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(
      resolvedTableId,
    )}/records?page_size=20` + (viewId ? `&view_id=${encodeURIComponent(viewId)}` : "");
  const recordsPayload = await feishuFetch<Record<string, unknown>>(recordsPath, { method: "GET" });
  const records = findArray(recordsPayload, ["items"]);
  const rows = records.map(formatBitableRecord).filter(Boolean);

  return {
    id: `${appToken}:${resolvedTableId}`,
    title: appName,
    source: "base",
    text: [
      `多维表格: ${appName}`,
      fieldNames.length ? `字段: ${fieldNames.join(", ")}` : "",
      rows.length ? rows.join("\n") : `已读取 ${records.length} 条记录，但记录字段为空。`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

async function readFirstTableId(appToken: string): Promise<string | undefined> {
  const payload = await feishuFetch<Record<string, unknown>>(
    `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables?page_size=20`,
    { method: "GET" },
  );
  const firstTable = readObject(findArray(payload, ["items"])[0]);

  return pickString(firstTable ?? {}, ["table_id"]);
}

async function tryReadRawContent(documentId: string): Promise<{ title?: string; text: string; url?: string }> {
  const rawPaths = [
    `/docx/v1/documents/${encodeURIComponent(documentId)}/raw_content`,
    `/docx/v1/documents/${encodeURIComponent(documentId)}/raw_content?lang=0`,
  ];

  for (const path of rawPaths) {
    try {
      const payload = await feishuFetch<Record<string, unknown>>(path, { method: "GET" });
      const data = readObject(payload.data) ?? payload;
      const text = pickString(data, ["content", "raw_content", "text"]);

      if (text) {
        return {
          title: pickString(data, ["title", "name"]),
          text,
          url: pickString(data, ["url"]),
        };
      }
    } catch {
      // Try the next compatible Feishu document endpoint.
    }
  }

  const blocks = await feishuFetch<Record<string, unknown>>(
    `/docx/v1/documents/${encodeURIComponent(documentId)}/blocks?page_size=500`,
    { method: "GET" },
  );

  const items = findArray(blocks, ["items", "blocks"]);
  const text = items.map(readBlockText).filter(Boolean).join("\n");

  if (!text) {
    throw new Error("Feishu document was found, but no readable text content was returned.");
  }

  return { text };
}

function extractSearchItems(payload: Record<string, unknown>): KnowledgeSource[] {
  const items = findArray(payload, ["items", "docs", "data"]);
  const sources: KnowledgeSource[] = [];

  for (const item of items) {
    const record = readObject(item);
    if (!record) {
      continue;
    }

    const id = pickString(record, [
      "document_id",
      "doc_token",
      "docs_token",
      "obj_token",
      "token",
      "id",
    ]);
    const title = pickString(record, ["title", "name", "doc_name"]);

    if (!id || !title) {
      continue;
    }

    sources.push({
      id,
      title,
      source: "feishu",
      url: pickString(record, ["url", "docs_url", "link"]),
    });
  }

  return sources;
}

function readBlockText(item: unknown): string {
  const record = readObject(item);
  if (!record) {
    return "";
  }

  const text = pickString(record, ["text", "plain_text", "content"]);
  if (text) {
    return text;
  }

  const block = readObject(record.block) ?? record;
  const textElement = readObject(block.text) ?? readObject(block.heading1) ?? readObject(block.heading2);
  const elements = findArray(textElement ?? block, ["elements"]);

  return elements
    .map((element) => {
      const elementObject = readObject(element);
      const textRun = readObject(elementObject?.text_run);
      return pickString(textRun ?? elementObject ?? {}, ["content", "text"]);
    })
    .filter(Boolean)
    .join("");
}

function parseFeishuUrl(url: string):
  | { type: "docx"; documentId: string }
  | { type: "base"; appToken: string; tableId?: string; viewId?: string } {
  const parsed = new URL(url);
  const [, type, token] = parsed.pathname.split("/");

  if (type === "docx" && token) {
    return { type: "docx", documentId: token };
  }

  if (type === "base" && token) {
    return {
      type: "base",
      appToken: token,
      tableId: parsed.searchParams.get("table") ?? undefined,
      viewId: parsed.searchParams.get("view") ?? undefined,
    };
  }

  throw new Error("Only Feishu docx and base URLs are supported in this spike.");
}

function formatBitableRecord(item: unknown): string {
  const fields = readObject(readObject(item)?.fields);
  if (!fields || Object.keys(fields).length === 0) {
    return "";
  }

  return Object.entries(fields)
    .map(([key, value]) => `${key}: ${formatBitableValue(value)}`)
    .join(" | ");
}

function formatBitableValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(formatBitableValue).join(", ");
  }

  const object = readObject(value);
  if (object) {
    return pickString(object, ["text", "name", "url", "link"]) ?? JSON.stringify(object);
  }

  return "";
}

function findArray(payload: unknown, keys: string[]): unknown[] {
  const queue: unknown[] = [payload];

  while (queue.length > 0) {
    const current = queue.shift();

    if (Array.isArray(current)) {
      return current;
    }

    const object = readObject(current);
    if (!object) {
      continue;
    }

    for (const key of keys) {
      if (Array.isArray(object[key])) {
        return object[key] as unknown[];
      }
    }

    queue.push(...Object.values(object));
  }

  return [];
}

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function readObject(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
}

function formatFeishuError(message: string, payload: FeishuErrorPayload): string {
  const details = [payload.code, payload.msg ?? payload.error].filter(Boolean).join(" ");

  return details ? `${message}: ${details}` : message;
}
