import {
  readFeishuDocument,
  resolveFeishuUrl,
  searchFeishuDocuments,
  type KnowledgeSource,
} from "@/lib/feishu";
import { saveRemoteKnowledgeSource } from "@/modules/knowledge/server/source-store";

export async function searchKnowledge(query: string) {
  return searchFeishuDocuments(query);
}

export async function resolveKnowledgeUrl(url: string) {
  const source = await resolveFeishuUrl(url);
  await rememberSource({ ...source, url });
  return { ...source, url };
}

export async function previewDocument(documentId: string) {
  const source = await readFeishuDocument(documentId);
  await rememberSource(source);
  return source;
}

export function knowledgeConnectorError(error: unknown) {
  const message = error instanceof Error ? error.message : "飞书知识读取失败。";

  if (message.includes("FEISHU_APP_ID") || message.includes("FEISHU_APP_SECRET")) {
    return { status: 503, message: "飞书连接尚未配置，请先设置 FEISHU_APP_ID 和 FEISHU_APP_SECRET。" };
  }

  if (message.includes("Only Feishu docx and base URLs")) {
    return { status: 400, message: "链接格式不支持，请粘贴飞书 docx 文档或 base 多维表格链接。" };
  }

  if (/permission|forbidden|999916|999914|access denied/i.test(message)) {
    return { status: 403, message: "飞书拒绝读取。请确认应用拥有只读权限，并且文档已授权给该应用。" };
  }

  return { status: 500, message };
}

async function rememberSource(source: KnowledgeSource) {
  if (source.source === "upload") {
    return;
  }

  await saveRemoteKnowledgeSource({
    id: source.id,
    title: source.title,
    source: source.source,
    url: source.url,
  });
}
