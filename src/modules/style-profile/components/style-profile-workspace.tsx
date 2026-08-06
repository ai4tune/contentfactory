"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AppShell,
  PageHeader,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/app-shell";
import {
  loadLocalKnowledge,
  readLocalKnowledgeItem,
  searchLocalKnowledge,
} from "@/modules/knowledge/local-index";
import type { LocalKnowledgeItem, RemoteKnowledgeSource } from "@/modules/knowledge/types";
import { channelLabels, contentChannels, type BriefKnowledgeSource } from "@/modules/content/types";
import {
  styleRuleCategories,
  styleSourceRoles,
  type StyleProfile,
  type StyleProfileInput,
  type StyleSourceRole,
} from "../types";

type SelectableSource = Omit<BriefKnowledgeSource, "text"> & { text?: string };
type SelectedSource = BriefKnowledgeSource & { role: StyleSourceRole };

const roleLabels: Record<StyleSourceRole, string> = {
  style_guide: "风格指南",
  banned_phrases: "禁用表达",
  approved_sample: "认可成稿",
  edit_feedback: "改稿反馈",
};

const categoryLabels = {
  identity: "身份与立场",
  narrative: "叙事方式",
  rhythm: "节奏结构",
  language: "语言表达",
  boundary: "表达边界",
};

export function StyleProfileWorkspace({
  accountName,
  initialProfile,
  initialConfirmedProfile,
}: {
  accountName: string;
  initialProfile: StyleProfile | null;
  initialConfirmedProfile: StyleProfile | null;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [confirmedProfile, setConfirmedProfile] = useState(initialConfirmedProfile);
  const [draft, setDraft] = useState<StyleProfileInput | null>(
    initialProfile?.status === "draft" ? toInput(initialProfile) : null,
  );
  const [editing, setEditing] = useState(initialProfile?.status === "draft");
  const [localItems, setLocalItems] = useState<LocalKnowledgeItem[]>([]);
  const [remoteItems, setRemoteItems] = useState<RemoteKnowledgeSource[]>([]);
  const [selected, setSelected] = useState<SelectedSource[]>([]);
  const [query, setQuery] = useState("");
  const [feishuUrl, setFeishuUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadLocalKnowledge().catch(() => []),
      fetch("/api/knowledge-sources", { cache: "no-store" })
        .then((response) => response.json())
        .then((payload: { sources?: RemoteKnowledgeSource[] }) => payload.sources ?? [])
        .catch(() => []),
    ]).then(([local, remote]) => {
      setLocalItems(local);
      setRemoteItems(remote);
    });
  }, []);

  const candidates = useMemo(() => {
    const local = searchLocalKnowledge(localItems, query).map(localToSource);
    const terms = query.trim().toLocaleLowerCase();
    const remote = remoteItems
      .filter((item) => !terms || `${item.title} ${item.url ?? ""}`.toLocaleLowerCase().includes(terms))
      .map(remoteToSource);
    return [...local, ...remote].slice(0, 60);
  }, [localItems, query, remoteItems]);

  async function selectSource(source: SelectableSource) {
    if (selected.some((item) => item.id === source.id)) return;
    await run(`read:${source.id}`, async () => {
      let full = source;
      if (source.source === "local") {
        full = { ...source, text: await readLocalKnowledgeItem(source.id) };
      } else if (!source.text) {
        const response = await fetch(`/api/integrations/feishu/documents/${encodeURIComponent(source.id)}`);
        const payload = await response.json() as { document?: SelectableSource; error?: string };
        if (!response.ok || !payload.document) throw new Error(payload.error ?? "读取飞书资料失败");
        full = payload.document;
      }
      if (!full.text?.trim()) throw new Error("这份资料没有可分析的正文。");
      setSelected((items) => [...items, { ...full, text: full.text!, role: inferRole(full) }]);
    });
  }

  async function addFeishuUrl() {
    if (!feishuUrl.trim()) return setMessage("请先粘贴飞书文档或多维表格链接。");
    await run("feishu", async () => {
      const response = await fetch("/api/integrations/feishu/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: feishuUrl }),
      });
      const payload = await response.json() as { document?: SelectableSource; error?: string };
      if (!response.ok || !payload.document) throw new Error(payload.error ?? "读取飞书链接失败");
      await selectSource(payload.document);
      setFeishuUrl("");
    });
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    const form = new FormData();
    Array.from(files).forEach((file) => form.append("files", file));
    await run("upload", async () => {
      const response = await fetch("/api/uploads", { method: "POST", body: form });
      const payload = await response.json() as { sources?: BriefKnowledgeSource[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "上传失败");
      setSelected((items) => [
        ...items,
        ...(payload.sources ?? []).filter((source) => !items.some((item) => item.id === source.id)).map((source) => ({
          ...source,
          role: inferRole(source),
        })),
      ]);
    });
  }

  async function analyze() {
    if (!selected.length) return setMessage("请先选择至少一份包含风格信息或认可成稿的资料。");
    await run("analyze", async () => {
      const response = await fetch("/api/style-profile/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: selected }),
      });
      const payload = await response.json() as { profile?: StyleProfileInput; error?: string };
      if (!response.ok || !payload.profile) throw new Error(payload.error ?? "风格分析失败");
      setDraft(payload.profile);
      setEditing(true);
      setMessage("已生成可编辑的风格档案。确认前不会影响内容创作。");
    });
  }

  async function persist(action: "save" | "confirm") {
    if (!draft) return;
    await run(action, async () => {
      const response = await fetch("/api/style-profile/current", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, profile: draft }),
      });
      const payload = await response.json() as { profile?: StyleProfile; error?: string; issues?: string[] };
      if (!response.ok || !payload.profile) {
        throw new Error([payload.error, ...(payload.issues ?? [])].filter(Boolean).join(" ") || "保存失败");
      }
      setProfile(payload.profile);
      if (action === "confirm") {
        setConfirmedProfile(payload.profile);
        setEditing(false);
        setDraft(null);
        setMessage("风格档案已确认，后续创作将使用这个版本。");
      } else {
        setMessage("草稿已保存。当前生效版本没有变化。");
      }
    });
  }

  async function run(key: string, task: () => Promise<void>) {
    setBusy(key);
    setMessage(null);
    try {
      await task();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusy(null);
    }
  }

  const displayProfile = profile?.status === "confirmed" ? profile : confirmedProfile;

  return (
    <AppShell active="/positioning">
      <PageHeader
        eyebrow="WRITING STYLE"
        title="写作风格"
        description={`为 ${accountName} 提炼一份可追溯的表达规则。AI 先分析，人工确认后才进入内容生成。`}
        actions={<Link className={secondaryButtonClass} href="/positioning">返回当前账号</Link>}
      />

      {displayProfile && !editing ? (
        <ConfirmedProfile
          profile={displayProfile}
          onEdit={() => { setDraft(toInput(displayProfile)); setEditing(true); setMessage(null); }}
        />
      ) : null}

      <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-emerald-700">01 SOURCE</p>
            <h2 className="mt-2 text-lg font-semibold">选择风格依据</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">建议选择 5 至 10 份资料，至少包含认可成稿或风格指南。GitHub 知识库可先克隆到本地，再通过知识库文件夹读取。</p>
          </div>
          <span className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">已选 {selected.length} 份</span>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
          <div>
            <input className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-700" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索风格指南、禁用词或认可成稿" />
            <div className="mt-3 max-h-72 overflow-y-auto rounded-2xl border border-slate-200">
              {candidates.length ? candidates.map((item) => {
                const chosen = selected.some((source) => source.id === item.id);
                return <button className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50 disabled:bg-emerald-50/60" disabled={chosen || Boolean(busy)} key={`${item.source}:${item.id}`} onClick={() => selectSource(item)} type="button"><span><span className="block text-sm font-medium text-slate-800">{item.title}</span><span className="mt-1 block text-xs text-slate-400">{item.path || item.url || sourceLabel(item.source)}</span></span><span className="shrink-0 text-xs font-semibold text-emerald-700">{chosen ? "已选择" : busy === `read:${item.id}` ? "读取中" : "选择"}</span></button>;
              }) : <div className="px-4 py-8 text-center text-sm text-slate-400">没有已连接的资料。请先到知识库连接本地文件夹，或在右侧添加飞书文档。</div>}
            </div>
          </div>

          <div className="grid content-start gap-3">
            <div className="flex gap-2"><input className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-700" value={feishuUrl} onChange={(event) => setFeishuUrl(event.target.value)} placeholder="粘贴飞书文档或多维表格链接" /><button className={secondaryButtonClass} disabled={Boolean(busy)} onClick={addFeishuUrl} type="button">读取</button></div>
            <label className={`${secondaryButtonClass} cursor-pointer`}><input className="hidden" multiple accept=".md,.txt,.csv" type="file" onChange={(event) => uploadFiles(event.target.files)} />临时上传资料</label>
            <Link className={`${secondaryButtonClass} text-center`} href="/knowledge">管理知识库连接</Link>
          </div>
        </div>

        {selected.length ? <div className="mt-5 grid gap-3 lg:grid-cols-2">{selected.map((source) => <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4" key={source.id}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">{source.title}</p><p className="mt-1 text-xs text-slate-400">{source.path || source.url || sourceLabel(source.source)}</p></div><button className="text-xs font-semibold text-slate-400 hover:text-rose-600" onClick={() => setSelected((items) => items.filter((item) => item.id !== source.id))} type="button">移除</button></div><select className="mt-3 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={source.role} onChange={(event) => setSelected((items) => items.map((item) => item.id === source.id ? { ...item, role: event.target.value as StyleSourceRole } : item))}>{styleSourceRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></div>)}</div> : null}

        <button className={`${primaryButtonClass} mt-5 w-full`} disabled={Boolean(busy) || !selected.length} onClick={analyze} type="button">{busy === "analyze" ? "AI 正在分析原文依据" : profile ? "基于所选资料重新分析" : "生成写作风格档案"}</button>
      </section>

      {draft && editing ? <ProfileEditor draft={draft} onChange={setDraft} onCancel={() => { setDraft(null); setEditing(false); }} onSave={() => persist("save")} onConfirm={() => persist("confirm")} busy={busy} hasConfirmed={Boolean(confirmedProfile)} /> : null}

      {message ? <p className={`mt-5 rounded-2xl px-4 py-3 text-sm ${/失败|不足|没有|请先|错误/.test(message) ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"}`}>{message}</p> : null}
    </AppShell>
  );
}

function ConfirmedProfile({ profile, onEdit }: { profile: StyleProfile; onEdit: () => void }) {
  return <section className="mt-7 grid gap-5 rounded-3xl bg-[#173e32] p-6 text-white shadow-sm lg:grid-cols-[1fr_auto] lg:p-7"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#dfb967] px-3 py-1 text-xs font-semibold text-[#173e32]">生效中 · v{profile.version}</span><span className="text-xs text-white/50">{profile.rules.length} 条规则 · {profile.examples.length} 个原文样例</span></div><h2 className="mt-5 text-xl font-semibold">{profile.name}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">{profile.persona}</p><div className="mt-5 flex flex-wrap gap-2">{profile.tone.map((item) => <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs" key={item}>{item}</span>)}</div></div><button className="h-10 rounded-xl border border-white/20 px-4 text-sm font-semibold text-white hover:bg-white/10" onClick={onEdit} type="button">编辑当前版本</button></section>;
}

function ProfileEditor({ draft, onChange, onSave, onConfirm, onCancel, busy, hasConfirmed }: { draft: StyleProfileInput; onChange: (value: StyleProfileInput) => void; onSave: () => void; onConfirm: () => void; onCancel: () => void; busy: string | null; hasConfirmed: boolean }) {
  return <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7"><p className="text-xs font-semibold tracking-[0.14em] text-emerald-700">02 REVIEW</p><div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-lg font-semibold">核对并调整风格档案</h2><p className="mt-1 text-sm leading-6 text-slate-500">可修改 AI 的归纳结论。原文依据保持只读，便于判断规则是否可信。</p></div>{hasConfirmed ? <span className="w-fit rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">确认前旧版本继续生效</span> : null}</div>
    <div className="mt-5 grid gap-4 lg:grid-cols-2"><Field label="档案名称" value={draft.name} onChange={(name) => onChange({ ...draft, name })} /><TextArea label="创作者身份" value={draft.persona} onChange={(persona) => onChange({ ...draft, persona })} rows={4} /><TextArea label="与读者的关系" value={draft.readerRelationship} onChange={(readerRelationship) => onChange({ ...draft, readerRelationship })} rows={4} /><ListField label="价值观" value={draft.values} onChange={(values) => onChange({ ...draft, values })} /><ListField label="语气" value={draft.tone} onChange={(tone) => onChange({ ...draft, tone })} /><ListField label="常用表达" value={draft.preferredPhrases} onChange={(preferredPhrases) => onChange({ ...draft, preferredPhrases })} /><ListField label="禁用表达" value={draft.bannedPhrases} onChange={(bannedPhrases) => onChange({ ...draft, bannedPhrases })} /></div>
    <div className="mt-7"><h3 className="text-sm font-semibold text-slate-900">可执行规则</h3><div className="mt-3 grid gap-3">{draft.rules.map((rule, index) => <div className="rounded-2xl border border-slate-200 p-4" key={rule.id}><div className="grid gap-3 sm:grid-cols-[150px_110px_1fr_auto]"><select className="h-10 rounded-xl border border-slate-200 px-3 text-sm" value={rule.category} onChange={(event) => onChange({ ...draft, rules: draft.rules.map((item, itemIndex) => itemIndex === index ? { ...item, category: event.target.value as typeof rule.category } : item) })}>{styleRuleCategories.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}</select><select className="h-10 rounded-xl border border-slate-200 px-3 text-sm" value={rule.priority} onChange={(event) => onChange({ ...draft, rules: draft.rules.map((item, itemIndex) => itemIndex === index ? { ...item, priority: event.target.value as typeof rule.priority } : item) })}><option value="hard">硬规则</option><option value="soft">偏好</option></select><input className="h-10 rounded-xl border border-slate-200 px-3 text-sm" value={rule.instruction} onChange={(event) => onChange({ ...draft, rules: draft.rules.map((item, itemIndex) => itemIndex === index ? { ...item, instruction: event.target.value } : item) })} /><button className="text-xs font-semibold text-slate-400 hover:text-rose-600" onClick={() => onChange({ ...draft, rules: draft.rules.filter((_, itemIndex) => itemIndex !== index) })} type="button">移除</button></div><div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500"><span className="font-semibold text-slate-700">原文依据：</span>{rule.evidence.map((item) => `“${item.excerpt}”`).join("；")}</div></div>)}</div></div>
    <div className="mt-7"><h3 className="text-sm font-semibold text-slate-900">渠道差异</h3><div className="mt-3 grid gap-4 lg:grid-cols-2">{contentChannels.map((channel) => <ListField key={channel} label={channelLabels[channel]} value={draft.channelOverrides[channel] ?? []} onChange={(items) => onChange({ ...draft, channelOverrides: { ...draft.channelOverrides, [channel]: items } })} />)}</div></div>
    <div className="mt-7"><h3 className="text-sm font-semibold text-slate-900">认可的原文样例</h3><div className="mt-3 grid gap-3 lg:grid-cols-2">{draft.examples.map((example, index) => <div className="rounded-2xl border border-slate-200 p-4" key={example.id}><p className="text-sm font-semibold text-slate-800">{example.title}</p><p className="mt-2 text-sm leading-6 text-slate-600">“{example.excerpt}”</p><input className="mt-3 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" value={example.purpose} onChange={(event) => onChange({ ...draft, examples: draft.examples.map((item, itemIndex) => itemIndex === index ? { ...item, purpose: event.target.value } : item) })} /></div>)}</div></div>
    <div className="mt-7 flex flex-wrap gap-3"><button className={primaryButtonClass} disabled={Boolean(busy)} onClick={onConfirm} type="button">{busy === "confirm" ? "正在确认" : "确认并用于后续创作"}</button><button className={secondaryButtonClass} disabled={Boolean(busy)} onClick={onSave} type="button">{busy === "save" ? "正在保存" : "保存草稿"}</button><button className={secondaryButtonClass} disabled={Boolean(busy)} onClick={onCancel} type="button">取消</button></div>
  </section>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="grid gap-2 text-sm font-medium text-slate-700"><span>{label}</span><input className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-700" value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function TextArea({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) { return <label className="grid gap-2 text-sm font-medium text-slate-700"><span>{label}</span><textarea className="resize-none rounded-xl border border-slate-200 px-3 py-3 leading-6 outline-none focus:border-emerald-700" value={value} onChange={(event) => onChange(event.target.value)} rows={rows} /></label>; }
function ListField({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string[]) => void }) { return <TextArea label={`${label}（每行一项）`} value={value.join("\n")} onChange={(text) => onChange(text.split("\n").map((item) => item.trim()).filter(Boolean))} rows={4} />; }

function toInput(profile: StyleProfile): StyleProfileInput {
  const { id, accountId, status, version, createdAt, updatedAt, confirmedAt, ...input } = profile;
  void id; void accountId; void status; void version; void createdAt; void updatedAt; void confirmedAt;
  return input;
}
function localToSource(item: LocalKnowledgeItem): SelectableSource { return { id: item.id, title: item.title, source: "local", path: item.path }; }
function remoteToSource(item: RemoteKnowledgeSource): SelectableSource { return { id: item.id, title: item.title, source: item.source, url: item.url }; }
function inferRole(source: Pick<SelectableSource, "title" | "path">): StyleSourceRole { const value = `${source.title} ${source.path ?? ""}`; if (/禁用|禁止|黑名单|AI味/.test(value)) return "banned_phrases"; if (/改稿|反馈|修改记录|偏好/.test(value)) return "edit_feedback"; if (/风格|表达|写作指南|叙事/.test(value)) return "style_guide"; return "approved_sample"; }
function sourceLabel(source: BriefKnowledgeSource["source"]) { return source === "local" ? "本地文件" : source === "upload" ? "临时上传" : source === "base" ? "飞书多维表格" : "飞书文档"; }
