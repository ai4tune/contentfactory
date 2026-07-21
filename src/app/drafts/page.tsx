import Link from "next/link";
import { AppShell, PageHeader, primaryButtonClass } from "@/components/app-shell";
import { DraftList } from "@/modules/drafts/components/draft-list";
import { listContentDrafts } from "@/modules/drafts/server/repository";

export const dynamic = "force-dynamic";

export default async function DraftsPage() {
  const drafts = await listContentDrafts();

  return (
    <AppShell active="/drafts">
      <PageHeader
        eyebrow="DRAFT HISTORY"
        title="草稿历史"
        description="找回统一简报和各渠道内容，继续修改后再复制或下载。"
        actions={
          <Link className={primaryButtonClass} href="/">
            写一篇新内容
          </Link>
        }
      />
      <DraftList initialDrafts={drafts} />
    </AppShell>
  );
}
