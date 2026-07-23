import Link from "next/link";
import { AppShell, PageHeader, primaryButtonClass } from "@/components/app-shell";
import { ContentLibrary } from "@/modules/drafts/components/content-library";
import { listContentLibraryItems } from "@/modules/drafts/server/repository";

export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  const items = await listContentLibraryItems();

  return (
    <AppShell active="/articles">
      <PageHeader eyebrow="CONTENT LIBRARY" title="内容库" description="草稿、已发布内容和平台表现都在一个列表中。发布后补充数据，系统才能知道什么内容真正有效。" actions={<Link className={primaryButtonClass} href="/create">＋ 写一篇内容</Link>} />
      <ContentLibrary initialItems={items} />
    </AppShell>
  );
}
