import { KnowledgeWorkspace } from "@/modules/knowledge/components/knowledge-workspace";

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ task?: string }> }) {
  const { task } = await searchParams;
  return <KnowledgeWorkspace key={task ?? "current"} initialOrganizationTaskId={task} />;
}
