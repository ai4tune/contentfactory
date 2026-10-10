"use client";

import { useState } from "react";
import Link from "@/components/navigation-link";
import type { LocalKnowledgeItem } from "@/modules/knowledge/types";
import type { BriefKnowledgeSource } from "@/modules/content/types";

export function ChatKnowledgePicker({ sources, onChange, disabled, onError }: {
  sources: BriefKnowledgeSource[]; onChange: (sources: BriefKnowledgeSource[]) => void; disabled: boolean; onError: (message: string) => void;
}) {
  const [items, setItems] = useState<LocalKnowledgeItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  async function read(connect: boolean) {
    setBusy(true);
    try {
      const { chooseKnowledgeDirectory, loadLocalKnowledge } = await import("@/modules/knowledge/local-index");
      setItems(connect ? (await chooseKnowledgeDirectory()).items : await loadLocalKnowledge()); setSelected([]); setOpen(true);
    }
    catch (error) { onError(error instanceof Error ? error.message : "文件夹尚未连接，请重试。"); }
    finally { setBusy(false); }
  }
  async function attach() {
    setBusy(true);
    try {
      const { readLocalKnowledgeItems } = await import("@/modules/knowledge/local-index");
      const text = await readLocalKnowledgeItems(selected);
      onChange(text.map(({ id, text }) => {
        const item = items.find((item) => item.id === id)!;
        return { id, title: item.title, source: "local", path: item.path, text: text.slice(0, 12000) };
      }));
      setOpen(false);
    } catch (error) { onError(error instanceof Error ? error.message : "资料未读取，请到知识库恢复权限后重试。"); }
    finally { setBusy(false); }
  }
  return <div className="mt-3 text-xs text-slate-600">
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={disabled || busy} className="font-semibold text-emerald-800 underline underline-offset-4 disabled:opacity-40" onClick={() => void read(false)}>选择知识文件</button>
      {sources.map((source) => <span className="rounded-md bg-emerald-50 px-2 py-1" key={source.id}>{source.title}<button type="button" disabled={disabled} aria-label={`移除${source.title}`} className="ml-2" onClick={() => onChange(sources.filter((item) => item.id !== source.id))}>×</button></span>)}
    </div>
    {open ? <div className="mt-3 rounded-xl border border-slate-200 p-3">
      <p className="leading-5">最多选择两份资料。发送时会将选中正文的前 12000 字交给 AI，并随当前账号的对话保存。</p>
      <div className="mt-2 flex flex-wrap gap-3"><button type="button" className="font-semibold text-emerald-800" disabled={busy} onClick={() => void read(true)}>连接文件夹</button><Link href="/knowledge">去知识库恢复权限或管理资料</Link></div>
      <input aria-label="搜索本地资料" className="mt-3 w-full rounded-lg border border-slate-200 p-2" placeholder="按标题或内容搜索" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="mt-2 max-h-44 overflow-auto">
        {items.filter((item) => `${item.title} ${item.searchText}`.includes(query)).slice(0, 50).map((item) => <label key={item.id} className="flex gap-2 py-2">
          <input type="checkbox" checked={selected.includes(item.id)} disabled={busy || (!selected.includes(item.id) && selected.length >= 2)} onChange={(event) => setSelected(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} />
          <span>{item.title}<span className="block text-slate-400">{item.path}</span></span>
        </label>)}
        {!items.length ? <p className="py-3">还没有本地索引，请先连接文件夹。</p> : null}
      </div>
      <div className="mt-3 flex gap-4"><button type="button" className="font-semibold text-emerald-800 disabled:opacity-40" disabled={busy || !selected.length} onClick={() => void attach()}>{busy ? "正在读取…" : "使用选中的资料"}</button><button type="button" onClick={() => setOpen(false)}>取消</button></div>
    </div> : null}
  </div>;
}
