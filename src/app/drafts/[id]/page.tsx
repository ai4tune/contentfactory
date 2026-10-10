import Link from "@/components/navigation-link";
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
        eyebrow="创作选题"
        title={draft.topic}
        description="在下方核对各渠道的最终标题和正文。每次保存都会保留上一版快照，发布由你手动完成。"
        actions={<Link className={secondaryButtonClass} href="/drafts">← 返回草稿历史</Link>}
      />
      <DraftDetail initialDraft={draft} />
    </AppShell>
  );
}
