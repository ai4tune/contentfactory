import { NextResponse } from "next/server";
import { normalizeKnowledgeProfileSources } from "@/modules/knowledge-profile/service";
import { createKnowledgeTask, getKnowledgeTask } from "@/modules/knowledge/tasks/repository";
import { launchKnowledgeTask, reconcileKnowledgeTasks } from "@/modules/knowledge/tasks/runtime";
import { publicKnowledgeTask } from "@/modules/knowledge/tasks/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    const tasks = await reconcileKnowledgeTasks();
    return NextResponse.json({ tasks: tasks.map(publicKnowledgeTask) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "暂时无法读取后台进度，请稍后刷新。" }, { status: 503 }); }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { kind?: unknown; sources?: unknown };
  if (body.kind !== "profile" && body.kind !== "organization") {
    return NextResponse.json({ error: "请选择建档或目录整理任务。" }, { status: 400 });
  }
  if (!Array.isArray(body.sources) || !body.sources.length || body.sources.length > 30) {
    return NextResponse.json({ error: "每次请选择 1–30 份有正文的资料。" }, { status: 400 });
  }
  const sources = normalizeKnowledgeProfileSources(body.sources);
  if (sources.length !== body.sources.length || new Set(sources.map((source) => source.id)).size !== sources.length) {
    return NextResponse.json({ error: "资料无法读取或存在重复，请重新选择。" }, { status: 400 });
  }
  try {
    await reconcileKnowledgeTasks();
    const { task, created } = await createKnowledgeTask(body.kind, sources);
    if (!created) return NextResponse.json({ error: "已有知识库任务正在后台处理，请等待完成后再提交。", task: publicKnowledgeTask(task) }, { status: 409 });
    await launchKnowledgeTask(task);
    return NextResponse.json({ task: publicKnowledgeTask((await getKnowledgeTask(task.id))!) }, { status: 202 });
  } catch { return NextResponse.json({ error: "后台任务提交失败，请稍后刷新并重试。" }, { status: 503 }); }
}
