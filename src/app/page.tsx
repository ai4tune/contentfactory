import Link from "next/link";
import { AppShell, PageHeader, secondaryButtonClass } from "@/components/app-shell";
import { ContentCreationWorkspace } from "@/modules/content/components/content-creation-workspace";
import { getCurrentAccountProfile } from "@/lib/store";

export const dynamic = "force-dynamic";

const steps = ["确定选题", "选择知识", "选择渠道", "生成并审核"];

export default async function ContentCreationPage() {
  const profile = await getCurrentAccountProfile();

  return (
    <AppShell active="/">
      <PageHeader
        eyebrow="CONTENT CREATION"
        title="从一个选题，开始今天的内容创作"
        description="选择真实知识资料和发布渠道，先生成一版可人工审核的内容。"
        actions={
          <Link className={secondaryButtonClass} href="/positioning">
            {profile ? "查看当前账号" : "先做账号定位"}
          </Link>
        }
      />

      <section className="mt-7 rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-5">
        <div className="grid gap-2 sm:grid-cols-4">
          {steps.map((step, index) => (
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3" key={step}>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#173e32] text-xs font-semibold text-white">
                {index + 1}
              </span>
              <span className="text-xs font-semibold text-slate-700">{step}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#d9e5de] bg-[#eef4f0] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="text-xs font-semibold text-emerald-900">当前账号上下文</p>
          <p className="mt-1 text-sm text-slate-600">
            {profile?.result.accountPosition || "还没有账号定位，可以先直接创作，后续再补充定位。"}
          </p>
        </div>
        <Link className="shrink-0 text-xs font-semibold text-emerald-900" href="/positioning">
          {profile ? "更新定位" : "快速定位"} →
        </Link>
      </section>

      <ContentCreationWorkspace />
    </AppShell>
  );
}
