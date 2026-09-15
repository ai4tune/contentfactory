import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, PageHeader, secondaryButtonClass } from "@/components/app-shell";
import { QuickCreationWorkspace } from "@/modules/content/quick/components/quick-creation-workspace";
import { getContentProject } from "@/modules/content/server/project-repository";
import { channelLabels } from "@/modules/content/types";
import { getCurrentAccountContext } from "@/modules/positioning/repository";
import { getContentPlan, getCurrentContentPlan } from "@/modules/plans/repository";
import { getConfirmedStyleProfile } from "@/modules/style-profile/repository";

export const dynamic = "force-dynamic";

export default async function QuickCreatePage({
  searchParams,
}: {
  searchParams: Promise<{ planId?: string; planItemId?: string }>;
}) {
  const values = await searchParams;
  const [plan, account, styleProfile] = await Promise.all([
    values.planId ? getContentPlan(values.planId) : getCurrentContentPlan(),
    getCurrentAccountContext(),
    getConfirmedStyleProfile(),
  ]);

  if (!plan || plan.status !== "confirmed") redirect("/plans");
  const item = values.planItemId
    ? plan.items.find((candidate) => candidate.id === values.planItemId)
    : plan.items
        .filter((candidate) => candidate.week === 1 && candidate.status === "pending")
        .slice()
        .sort((left, right) => left.priority - right.priority)[0];
  if (!item) redirect("/plans");

  if (item.contentProjectId) {
    const existingProject = await getContentProject(item.contentProjectId);
    if (existingProject) redirect(`/drafts/${encodeURIComponent(existingProject.id)}`);
  }

  return (
    <AppShell active="/create/quick">
      <PageHeader
        eyebrow="QUICK CREATE"
        title="快速创作"
        description="确认 AI 为这个选题匹配的企业资料，一次生成主渠道稿并进入人工审核。"
        actions={<Link className={secondaryButtonClass} href="/create">切换到高级创作</Link>}
      />

      <section className="mt-7 grid gap-4 rounded-2xl bg-[#173e32] p-5 text-white sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
        <ContextItem label="本次选题" value={item.title} />
        <ContextItem label="内容目的" value={objectiveLabel(item.objective)} />
        <ContextItem label="主渠道" value={channelLabels[plan.primaryChannel]} />
        <ContextItem label="账号与风格" value={`${account?.accountName || "当前企业"} · ${styleProfile?.name || "使用品牌语气"}`} />
      </section>

      <QuickCreationWorkspace
        accountPosition={account?.accountPosition || "尚未确认账号定位"}
        channel={plan.primaryChannel}
        contentPlanId={plan.id}
        contentPlanItemId={item.id}
        itemAngle={item.angle}
        itemRationale={item.rationale}
      />
    </AppShell>
  );
}

function ContextItem({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-xs text-white/45">{label}</p><p className="mt-2 text-sm font-semibold leading-6 text-white/90">{value}</p></div>;
}

function objectiveLabel(objective: "reach" | "trust" | "conversion") {
  return { reach: "扩大认知", trust: "建立信任", conversion: "推动转化" }[objective];
}
