import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell, PageHeader, secondaryButtonClass } from "@/components/app-shell";
import { DraftDetail } from "@/modules/drafts/components/draft-detail";
import { getContentDraft } from "@/modules/drafts/server/repository";

export const dynamic = "force-dynamic";

export default async function DraftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = await getContentDraft(id);
  if (!draft) notFound();

  return (
    <AppShell active="/drafts">
      <PageHeader
        eyebrow="CONTINUE EDITING"
        title={draft.topic}
        description="查看已确认简报和引用，继续编辑各渠道内容。每次保存都会保留上一版快照。"
        actions={<Link className={secondaryButtonClass} href="/drafts">← 返回草稿历史</Link>}
      />
      <DraftDetail initialDraft={draft} />
    </AppShell>
  );
}
