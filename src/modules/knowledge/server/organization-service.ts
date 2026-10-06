import { chatCompletionJson, parseJsonObject } from "@/lib/ai";
import type { BriefKnowledgeSource } from "@/modules/content/types";
import {
  knowledgeOrganizationFolders,
  type KnowledgeOrganizationAssignment,
  type KnowledgeOrganizationFolderId,
  type KnowledgeOrganizationPlan,
} from "../organization";

const folderIds = new Set<KnowledgeOrganizationFolderId>(
  knowledgeOrganizationFolders.map((folder) => folder.id),
);

export async function planKnowledgeOrganization(
  sources: BriefKnowledgeSource[],
): Promise<KnowledgeOrganizationPlan> {
  const sourceSummary = sources.map((source) => ({
    id: source.id,
    title: source.title,
    path: source.path,
    excerpt: source.text.slice(0, 4_000),
  }));
  const content = await chatCompletionJson([
    {
      role: "system",
      content: [
        "你是企业知识库整理助手。只输出 JSON，不要 Markdown。",
        "JSON 字段只包含 summary 和 assignments。",
        "assignments 每项必须包含 sourceId, folderId, reason，每份资料只能分到一个目录。",
        `folderId 只能是：${knowledgeOrganizationFolders.map((folder) => `${folder.id}=${folder.name}`).join("、")}。`,
        "无法准确判断时必须放入 pending，不得根据行业经验补造资料内容。",
      ].join("\n"),
    },
    {
      role: "user",
      content: `请为以下资料生成目录归类方案：\n${JSON.stringify(sourceSummary)}`,
    },
  ], { timeoutMs: 120_000 });
  return normalizePlan(parseJsonObject(content), sources);
}

function normalizePlan(value: unknown, sources: BriefKnowledgeSource[]): KnowledgeOrganizationPlan {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const sourceIds = new Set(sources.map((source) => source.id));
  const assigned = new Set<string>();
  const assignments = Array.isArray(record.assignments)
    ? record.assignments.flatMap((value): KnowledgeOrganizationAssignment[] => {
        const item = value && typeof value === "object" && !Array.isArray(value)
          ? value as Record<string, unknown>
          : {};
        const sourceId = String(item.sourceId ?? "").trim();
        const folderId = String(item.folderId ?? "").trim() as KnowledgeOrganizationFolderId;
        if (!sourceIds.has(sourceId) || assigned.has(sourceId) || !folderIds.has(folderId)) return [];
        assigned.add(sourceId);
        return [{
          sourceId,
          folderId,
          reason: String(item.reason ?? "").trim().slice(0, 300) || "根据资料主题归类。",
        }];
      })
    : [];
  for (const source of sources) {
    if (!assigned.has(source.id)) {
      assignments.push({ sourceId: source.id, folderId: "pending", reason: "AI 未能确定归类，需要人工确认。" });
    }
  }
  return {
    summary: String(record.summary ?? "").trim().slice(0, 1_000) || `已为 ${sources.length} 份资料生成非破坏式整理方案。`,
    folders: [...knowledgeOrganizationFolders],
    assignments,
  };
}
