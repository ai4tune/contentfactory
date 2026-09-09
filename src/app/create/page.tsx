import Link from "next/link";
import { AppShell, PageHeader, secondaryButtonClass } from "@/components/app-shell";
import { getConfigStatus } from "@/lib/config";
import { ContentCreationWorkspace } from "@/modules/content/components/content-creation-workspace";
import { getCurrentAccountContext } from "@/modules/positioning/repository";
import { getConfirmedStyleProfile } from "@/modules/style-profile/repository";

export const dynamic = "force-dynamic";

const creationSteps = [
  { title: "选择依据", description: "选择知识资料或一篇爆款参考" },
  { title: "确定题目", description: "手写标题，或让 AI 推荐一批" },
  { title: "生成简报", description: "统一受众、观点、结构和引用" },
  { title: "人工确认", description: "确认后创建本次内容项目" },
];

export default async function ContentCreationPage({
  searchParams,
}: {
  searchParams?: Promise<{ ideaId?: string; title?: string; sourceUrl?: string }>;
}) {
  const params = await searchParams;
  const ideaTitle = params?.title ? decodeURIComponent(params.title) : undefined;
  const ideaSourceUrl = params?.sourceUrl ? decodeURIComponent(params.sourceUrl) : undefined;

  const [accountContext, styleProfile, status] = await Promise.all([
    getCurrentAccountContext(),
    getConfirmedStyleProfile(),
    Promise.resolve(getConfigStatus()),
  ]);

  return (
    <AppShell active="/create">
      <PageHeader
        title="选择创作方式，开始今天的内容"
        description="可以基于自己的知识原创，也可以学习爆款的钩子和结构后重新创作。"
        actions={
          <Link className={secondaryButtonClass} href="/positioning">
            {accountContext?.status === "confirmed" ? "查看当前账号" : "快速建立账号定位"}
          </Link>
        }
      />

      <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid gap-px bg-slate-200 md:grid-cols-4">
          {creationSteps.map((step, index) => (
            <div className="bg-white px-5 py-4" key={step.title}>
              <div className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 font-mono text-xs font-semibold text-emerald-800">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{step.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 flex flex-col gap-4 rounded-2xl border border-emerald-900/10 bg-[#e9f0ec] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-emerald-800">当前创作上下文</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900">
            {accountContext?.status === "confirmed" ? accountContext.accountName || "当前账号" : "暂未确认账号定位"}
          </p>
          <p className="mt-1 line-clamp-1 text-xs text-slate-600">
            {accountContext?.status === "confirmed" ? accountContext.accountPosition : "你可以先跳过定位开始创作，稍后再补充。"}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 text-xs">
          <StatusLabel label="AI" ready={status.aiConfigured} />
          <StatusLabel label="飞书" ready={status.feishuConfigured} />
          <StatusLabel label="文件" ready={status.uploadEnabled} />
        </div>
      </section>

      <ContentCreationWorkspace
        initialStyleProfile={styleProfile}
        ideaTitle={ideaTitle}
        ideaSourceUrl={ideaSourceUrl}
      />
    </AppShell>
  );
}

function StatusLabel({ label, ready }: { label: string; ready: boolean }) {
  return (
    <span
      className={`rounded-lg border px-2.5 py-1.5 font-medium ${
        ready
          ? "border-emerald-800/15 bg-white text-emerald-800"
          : "border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      {label} {ready ? "已就绪" : "待配置"}
    </span>
  );
}
