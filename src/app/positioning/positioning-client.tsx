"use client";

import { useState } from "react";
import { AppShell, PageHeader, primaryButtonClass, secondaryButtonClass } from "@/components/app-shell";
import type { PositioningRequest, PositioningResult } from "@/lib/ai";
import type { StoredRecord } from "@/lib/store";

type Profile = StoredRecord<PositioningRequest, PositioningResult>;

const emptyForm: PositioningRequest = {
  accountName: "",
  business: "",
  audience: "",
  offer: "",
  differentiator: "",
  platforms: "小红书、公众号、视频号",
  goal: "获客、信任建设、成交转化",
  currentContent: "",
};

export function PositioningClient({ initialProfile }: { initialProfile: Profile | null }) {
  const [profile, setProfile] = useState(initialProfile);
  const [editing, setEditing] = useState(!initialProfile);
  const [form, setForm] = useState<PositioningRequest>(initialProfile?.input ?? emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/positioning/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as { record?: Profile; error?: string };

      if (!response.ok || !payload.record) {
        throw new Error(payload.error ?? "定位分析失败");
      }

      setProfile(payload.record);
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "定位分析失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell active="/positioning">
      <PageHeader
        eyebrow="ACCOUNT STRATEGY"
        title={profile ? "当前账号定位" : "建立你的账号定位"}
        description={
          profile
            ? "这份定位是整个内容工厂的共同上下文。选题、爆款拆解和内容生成都会自动使用它。"
            : "首次完成后系统会记住当前账号，后续无需重复填写。"
        }
        actions={
          profile && !editing ? (
            <button className={secondaryButtonClass} onClick={() => setEditing(true)}>
              升级定位
            </button>
          ) : undefined
        }
      />

      {profile && !editing ? (
        <div className="mt-7 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-3xl bg-[#173e32] p-6 text-white shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#dfb967] px-3 py-1 text-xs font-semibold text-[#173e32]">当前唯一账号</span>
              <span className="text-xs text-white/55">更新于 {formatDate(profile.createdAt)}</span>
            </div>
            <h2 className="mt-7 text-2xl font-semibold">{profile.input.accountName || "未命名账号"}</h2>
            <p className="mt-4 text-lg leading-8 text-white/85">{profile.result.accountPosition}</p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <Stat label="目标客户" value={profile.input.audience} />
              <Stat label="核心产品" value={profile.input.offer} />
              <Stat label="主要平台" value={profile.input.platforms || "待确认"} />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold tracking-[0.16em] text-emerald-700">接下来系统会做什么</p>
            <ol className="mt-5 space-y-4">
              {[
                "用定位生成搜索关键词与选题方向",
                "判断外部爆款哪些结构适合当前账号",
                "结合企业素材生成符合定位的内容",
                "根据发布数据持续校准内容方向",
              ].map((item, index) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-slate-600">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700">
                    {index + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
            <div className="grid gap-7 lg:grid-cols-2">
              <ResultGroup title="内容支柱" items={profile.result.contentPillars} />
              <ResultGroup title="关键词种子" items={profile.result.keywordSeeds} tags />
              <ResultGroup title="首批内容角度" items={profile.result.contentAngles} />
              <ResultGroup title="下一步动作" items={profile.result.nextActions} />
            </div>
          </section>
        </div>
      ) : (
        <section className="mt-7 grid gap-5 xl:grid-cols-[1fr_0.72fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm leading-6 text-emerald-900">
              可以先用浏览器插件采集账号主页，再把采集到的简介、历史内容和表现摘要放到“现有内容”中；当前版本也支持直接补充关键业务信息。
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="账号/品牌名" value={form.accountName} onChange={(value) => setForm({ ...form, accountName: value })} placeholder="例如：某某建材" />
              <Field label="业务类型" required value={form.business} onChange={(value) => setForm({ ...form, business: value })} placeholder="例如：本地建材门店" />
              <Field label="目标客户" required value={form.audience} onChange={(value) => setForm({ ...form, audience: value })} placeholder="例如：准备装修的本地业主" />
              <Field label="产品/服务" required value={form.offer} onChange={(value) => setForm({ ...form, offer: value })} placeholder="例如：地板和安装服务" />
              <Field label="主要平台" value={form.platforms || ""} onChange={(value) => setForm({ ...form, platforms: value })} placeholder="小红书、公众号、视频号" />
              <Field label="内容目标" value={form.goal || ""} onChange={(value) => setForm({ ...form, goal: value })} placeholder="获客、信任建设、成交转化" />
            </div>
            <div className="mt-4 grid gap-4">
              <TextArea label="差异化优势" value={form.differentiator || ""} onChange={(value) => setForm({ ...form, differentiator: value })} placeholder="真实案例、服务能力、经验和交付保障" rows={3} />
              <TextArea label="现有内容或插件采集结果" value={form.currentContent || ""} onChange={(value) => setForm({ ...form, currentContent: value })} placeholder="粘贴账号简介、代表性文章、点赞收藏表现和你观察到的问题" rows={7} />
            </div>
            {error ? <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button className={primaryButtonClass} onClick={analyze} disabled={busy}>
                {busy ? "AI 正在建立定位…" : profile ? "重新分析并更新" : "建立账号定位"}
              </button>
              {profile ? (
                <button className={secondaryButtonClass} onClick={() => setEditing(false)}>
                  取消
                </button>
              ) : null}
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold">为什么只做一个账号</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">公司前期最重要的是稳定一个内容方向。定位一旦确定，后续动作就围绕同一目标积累，而不是反复从零开始。</p>
            <div className="mt-6 space-y-3">
              {[
                ["一次建立", "只在方向变化时升级"],
                ["全程继承", "选题和创作自动调用"],
                ["数据校准", "发布后用结果修正方向"],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{body}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>
      )}
    </AppShell>
  );
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      <span>{label}{required ? <span className="text-rose-600"> *</span> : null}</span>
      <input className="h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-emerald-700" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder, rows }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; rows: number }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <textarea className="resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 leading-6 outline-none transition focus:border-emerald-700" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-white/8 p-4"><p className="text-xs text-white/45">{label}</p><p className="mt-2 text-sm leading-6 text-white/85">{value}</p></div>;
}

function ResultGroup({ title, items, tags }: { title: string; items: string[]; tags?: boolean }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      {tags ? (
        <div className="mt-3 flex flex-wrap gap-2">{items.map((item) => <span key={item} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800">{item}</span>)}</div>
      ) : (
        <ul className="mt-3 space-y-2">{items.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-slate-600"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#dfb967]" />{item}</li>)}</ul>
      )}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

