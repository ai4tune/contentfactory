import Link from "next/link";
import { AppShell, PageHeader, primaryButtonClass } from "@/components/app-shell";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function DraftsPage() {
  const store = await readStore();
  const drafts = store.articles.filter((article) => !article.publication).reverse();

  return (
    <AppShell active="/drafts">
      <PageHeader
        eyebrow="DRAFT HISTORY"
        title="草稿历史"
        description="查看已经生成的内容，选择一篇继续人工审核或复制发布。"
        actions={
          <Link className={primaryButtonClass} href="/">
            写一篇新内容
          </Link>
        }
      />

      <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {drafts.length ? (
          <div className="divide-y divide-slate-100">
            {drafts.map((draft) => (
              <article className="grid gap-3 px-5 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6" key={draft.id}>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-slate-900">{draft.input.topic}</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {draft.input.platform || "未选择渠道"} · {formatDate(draft.createdAt)}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{draft.result.draft}</p>
                </div>
                <span className="w-fit rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800">待人工审核</span>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-[#e9f0ec] text-lg font-semibold text-emerald-900">稿</span>
            <h2 className="mt-5 text-base font-semibold">还没有草稿</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">完成一次内容生成后，草稿会出现在这里。</p>
            <Link className={`${primaryButtonClass} mt-5`} href="/">
              开始写第一篇
            </Link>
          </div>
        )}
      </section>
    </AppShell>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
