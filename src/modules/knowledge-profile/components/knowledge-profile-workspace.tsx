"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell, PageHeader, primaryButtonClass, secondaryButtonClass } from "@/components/app-shell";
import type { EnterpriseKnowledgeProfile, EnterpriseKnowledgeProfileInput } from "../types";

type ProfileState = {
  draft: EnterpriseKnowledgeProfile | null;
  confirmed: EnterpriseKnowledgeProfile | null;
  history: EnterpriseKnowledgeProfile[];
};

export function KnowledgeProfileWorkspace({ initialState }: { initialState: ProfileState }) {
  const [state, setState] = useState(initialState);
  const [draft, setDraft] = useState<EnterpriseKnowledgeProfileInput | null>(
    initialState.draft ? toInput(initialState.draft) : null,
  );
  const [editing, setEditing] = useState(Boolean(initialState.draft));
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function persist(action: "save" | "confirm") {
    if (!draft) return;
    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch("/api/knowledge-profile/current", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, profile: draft }),
      });
      const payload = await response.json() as { profile?: EnterpriseKnowledgeProfile; error?: string };
      if (!response.ok || !payload.profile) throw new Error(payload.error ?? "保存失败。");
      if (action === "confirm") {
        const previous = state.confirmed;
        setState({
          draft: null,
          confirmed: payload.profile,
          history: previous ? [{ ...previous, status: "archived" }, ...state.history] : state.history,
        });
        setDraft(null);
        setEditing(false);
        setMessage(`企业知识档案 v${payload.profile.version} 已确认，后续选题与创作会记录这个版本。`);
      } else {
        setState((current) => ({ ...current, draft: payload.profile! }));
        setMessage("草稿已保存，当前生效版本没有变化。");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setBusy(null);
    }
  }

  const display = state.confirmed;
  return <AppShell active="/knowledge">
    <PageHeader
      eyebrow="ENTERPRISE KNOWLEDGE PROFILE"
      title="企业知识档案"
      description="把零散资料整理成可编辑、可引用、可追溯版本。只有人工确认后的档案会进入选题和创作。"
      actions={<Link className={secondaryButtonClass} href="/knowledge">返回知识库</Link>}
    />

    {message ? <p className={`mt-5 rounded-2xl px-4 py-3 text-sm ${/失败|缺少|请/.test(message) ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"}`}>{message}</p> : null}

    {display && !editing ? <section className="mt-7 rounded-3xl bg-[#173e32] p-6 text-white shadow-sm sm:p-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><span className="rounded-full bg-[#dfb967] px-3 py-1 text-xs font-semibold text-[#173e32]">生效中 · v{display.version}</span><h2 className="mt-5 text-xl font-semibold">{display.name}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">{display.businessSummary}</p><p className="mt-4 text-xs text-white/50">{display.sources.length} 个来源 · {display.facts.filter((fact) => fact.confidence === "confirmed").length} 条已确认事实 · {display.gaps.length} 个待补缺口</p></div><button className="h-10 rounded-xl border border-white/20 px-4 text-sm font-semibold hover:bg-white/10" onClick={() => { setDraft(toInput(display)); setEditing(true); }} type="button">基于当前版本编辑</button></div></section> : null}

    {!draft && !display ? <section className="mt-7 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="text-lg font-semibold">还没有企业知识档案</h2><p className="mt-2 text-sm text-slate-500">回到知识库选择资料，AI 会先生成一份可编辑草稿。</p><Link className={`${primaryButtonClass} mt-5`} href="/knowledge">选择资料并整理</Link></section> : null}

    {draft && editing ? <ProfileEditor draft={draft} setDraft={setDraft} busy={busy} onSave={() => persist("save")} onConfirm={() => persist("confirm")} onCancel={() => { setDraft(null); setEditing(false); }} hasConfirmed={Boolean(state.confirmed)} /> : null}

    {state.history.length ? <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-base font-semibold">历史版本</h2><div className="mt-4 divide-y divide-slate-100">{state.history.map((profile) => <div className="flex items-center justify-between py-3 text-sm" key={profile.id}><span>v{profile.version} · {profile.name}</span><span className="text-xs text-slate-400">{new Date(profile.updatedAt).toLocaleString("zh-CN")}</span></div>)}</div></section> : null}
  </AppShell>;
}

function ProfileEditor({ draft, setDraft, busy, onSave, onConfirm, onCancel, hasConfirmed }: { draft: EnterpriseKnowledgeProfileInput; setDraft: (value: EnterpriseKnowledgeProfileInput) => void; busy: string | null; onSave: () => void; onConfirm: () => void; onCancel: () => void; hasConfirmed: boolean }) {
  return <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold tracking-[0.14em] text-emerald-700">REVIEW BEFORE USE</p><h2 className="mt-2 text-lg font-semibold">核对企业知识档案</h2><p className="mt-1 text-sm leading-6 text-slate-500">AI 的归纳可以修改。没有来源的事实不能标记为已确认。</p></div>{hasConfirmed ? <span className="w-fit rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">确认前旧版本继续生效</span> : null}</div>
    <div className="mt-6 grid gap-4 lg:grid-cols-2"><Field label="档案名称" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} /><TextArea label="业务概述" value={draft.businessSummary} onChange={(businessSummary) => setDraft({ ...draft, businessSummary })} /><ListField label="目标客户" value={draft.targetCustomers} onChange={(targetCustomers) => setDraft({ ...draft, targetCustomers })} /><ListField label="核心优势" value={draft.strengths} onChange={(strengths) => setDraft({ ...draft, strengths })} /><ListField label="经营目标" value={draft.businessGoals} onChange={(businessGoals) => setDraft({ ...draft, businessGoals })} /><ListField label="优先内容方向" value={draft.preferredTopics} onChange={(preferredTopics) => setDraft({ ...draft, preferredTopics })} /><ListField label="禁止或需谨慎的表述" value={draft.forbiddenClaims} onChange={(forbiddenClaims) => setDraft({ ...draft, forbiddenClaims })} /><ListField label="待补充信息" value={draft.gaps} onChange={(gaps) => setDraft({ ...draft, gaps })} /></div>
    <div className="mt-7"><h3 className="text-sm font-semibold">产品与服务</h3><div className="mt-3 grid gap-3">{draft.offers.map((offer, index) => <div className="grid gap-3 rounded-2xl border border-slate-200 p-4 lg:grid-cols-[0.7fr_1.3fr_auto]" key={offer.id}><input className="h-10 rounded-xl border border-slate-200 px-3 text-sm" value={offer.name} onChange={(event) => setDraft({ ...draft, offers: draft.offers.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} /><textarea className="rounded-xl border border-slate-200 px-3 py-2 text-sm" rows={2} value={offer.description} onChange={(event) => setDraft({ ...draft, offers: draft.offers.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item) })} /><button className="text-xs font-semibold text-slate-400 hover:text-rose-600" onClick={() => setDraft({ ...draft, offers: draft.offers.filter((_, itemIndex) => itemIndex !== index) })} type="button">移除</button><p className="text-xs text-slate-400 lg:col-span-3">来源：{sourceTitles(offer.sourceIds, draft) || "无"}</p></div>)}</div></div>
    <div className="mt-7"><h3 className="text-sm font-semibold">事实清单</h3><div className="mt-3 grid gap-3">{draft.facts.map((fact, index) => <div className="rounded-2xl border border-slate-200 p-4" key={fact.id}><div className="grid gap-3 lg:grid-cols-[130px_1fr_160px_auto]"><input className="h-10 rounded-xl border border-slate-200 px-3 text-sm" value={fact.category} onChange={(event) => setDraft({ ...draft, facts: draft.facts.map((item, itemIndex) => itemIndex === index ? { ...item, category: event.target.value } : item) })} /><input className="h-10 rounded-xl border border-slate-200 px-3 text-sm" value={fact.statement} onChange={(event) => setDraft({ ...draft, facts: draft.facts.map((item, itemIndex) => itemIndex === index ? { ...item, statement: event.target.value } : item) })} /><select className="h-10 rounded-xl border border-slate-200 px-3 text-sm" value={fact.confidence} onChange={(event) => setDraft({ ...draft, facts: draft.facts.map((item, itemIndex) => itemIndex === index ? { ...item, confidence: event.target.value as typeof fact.confidence } : item) })}><option value="confirmed" disabled={!fact.sourceIds.length}>已确认</option><option value="needs_confirmation">待确认</option></select><button className="text-xs font-semibold text-slate-400 hover:text-rose-600" onClick={() => setDraft({ ...draft, facts: draft.facts.filter((_, itemIndex) => itemIndex !== index) })} type="button">移除</button></div><p className="mt-2 text-xs text-slate-400">来源：{sourceTitles(fact.sourceIds, draft) || "无来源，只能保持待确认"}</p></div>)}</div></div>
    <div className="mt-7 rounded-2xl bg-slate-50 p-4"><h3 className="text-sm font-semibold">本版本来源（仅保存标识，不保存本地正文）</h3><div className="mt-3 flex flex-wrap gap-2">{draft.sources.map((source) => <span className="rounded-full bg-white px-3 py-1.5 text-xs text-slate-600" key={source.id}>{source.title}</span>)}</div></div>
    <div className="mt-7 flex flex-wrap gap-3"><button className={primaryButtonClass} disabled={Boolean(busy)} onClick={onConfirm} type="button">{busy === "confirm" ? "正在确认…" : "确认并用于选题与创作"}</button><button className={secondaryButtonClass} disabled={Boolean(busy)} onClick={onSave} type="button">{busy === "save" ? "正在保存…" : "保存草稿"}</button><button className={secondaryButtonClass} disabled={Boolean(busy)} onClick={onCancel} type="button">取消</button></div>
  </section>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="grid gap-2 text-sm font-medium text-slate-700"><span>{label}</span><input className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-700" value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="grid gap-2 text-sm font-medium text-slate-700"><span>{label}</span><textarea className="resize-none rounded-xl border border-slate-200 px-3 py-3 leading-6 outline-none focus:border-emerald-700" rows={5} value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function ListField({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string[]) => void }) { return <TextArea label={`${label}（每行一项）`} value={value.join("\n")} onChange={(text) => onChange(text.split("\n").map((item) => item.trim()).filter(Boolean))} />; }
function sourceTitles(sourceIds: string[], profile: EnterpriseKnowledgeProfileInput) { const titleById = new Map(profile.sources.map((source) => [source.id, source.title])); return sourceIds.map((id) => titleById.get(id)).filter(Boolean).join("、"); }
function toInput(profile: EnterpriseKnowledgeProfile): EnterpriseKnowledgeProfileInput { const { id, schemaVersion, status, version, createdAt, updatedAt, confirmedAt, ...input } = profile; void id; void schemaVersion; void status; void version; void createdAt; void updatedAt; void confirmedAt; return input; }
