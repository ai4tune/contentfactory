"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/navigation-link";
import type { BriefKnowledgeSource } from "@/modules/content/types";
import { isActiveTurn, type ChatMessage, type ChatStore, type ChatTurn } from "@/modules/agent/chat/types";
import { ChatKnowledgePicker } from "./chat-knowledge-picker";
import type { ResearchRecord, ResearchLocation } from "@/modules/research/types";

type Snapshot = ChatStore & { workspaceId: string };
type MemoryEdit = { id: string; content: string; sourceMessageId: string };
const empty: Snapshot = { conversations: [], turns: [], memories: [], workspaceId: "" };

export function ChatWorkspace({ primaryHref }: { primaryHref: string }) {
  const [state, setState] = useState<Snapshot>(empty);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sources, setSources] = useState<BriefKnowledgeSource[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [memory, setMemory] = useState<MemoryEdit | null>(null);
  const [ready, setReady] = useState(false);
  const scope = useRef("");
  const loadVersion = useRef(0);
  const messagesBox = useRef<HTMLDivElement>(null);
  const pending = useRef<{ requestId: string; content: string; sources: BriefKnowledgeSource[]; conversationId?: string } | null>(null);
  const refresh = useCallback(async () => {
    const version = ++loadVersion.current;
    let next: Snapshot;
    try { next = await call("/api/agent/chat") as Snapshot; }
    catch (error) {
      if (version === loadVersion.current && error instanceof RequestError && [401, 403].includes(error.status)) {
        setState(empty); setReady(false); setInput(""); setSources([]); setMemory(null); setConversationId(null); pending.current = null; scope.current = "";
      }
      throw error;
    }
    if (version !== loadVersion.current) return;
    if (scope.current && scope.current !== next.workspaceId) {
      setInput(""); setSources([]); setMemory(null); setConversationId(null); pending.current = null;
    }
    scope.current = next.workspaceId;
    setState(next); setReady(true);
    setConversationId((id) => id === null ? next.conversations.at(-1)?.id ?? "" : id);
  }, []);
  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try { await refresh(); }
      catch (error) { if (mounted) setError(error instanceof Error ? error.message : "读取对话未完成。"); }
      if (mounted) timer = setTimeout(() => void poll(), 3000);
    }
    void poll();
    return () => { mounted = false; clearTimeout(timer); loadVersion.current += 1; };
  }, [refresh]);
  const active = state.turns.find(isActiveTurn);
  const conversation = state.conversations.find((item) => item.id === conversationId);
  useEffect(() => { const box = messagesBox.current; if (box) box.scrollTop = box.scrollHeight; }, [conversationId, conversation?.messages.length]);
  async function action(work: () => Promise<void>) {
    setBusy(true); setError("");
    try { await work(); await refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "操作未完成，请重试。"); }
    finally { setBusy(false); }
  }
  async function send() {
    if (!input.trim() || busy || active || !ready) return;
    await action(async () => {
      pending.current ??= { requestId: crypto.randomUUID(), content: input.trim(), sources, ...(conversationId ? { conversationId } : {}) };
      const payload = await call("/api/agent/chat", pending.current) as { turn: ChatTurn };
      setConversationId(payload.turn.conversationId); setInput(""); setSources([]); pending.current = null;
    });
  }
  function remember(message: ChatMessage) {
    const existing = state.memories.find((item) => item.sourceMessageId === message.id);
    setMemory(existing ?? { id: crypto.randomUUID(), content: message.content.slice(0, 500), sourceMessageId: message.id });
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="小掌柜 AI 对话">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-900">和小掌柜聊聊</h2><p className="mt-1 text-xs leading-5 text-slate-500">说出诉求，我会读取资料、执行任务，并保留这次对话。</p></div>
      <button type="button" disabled={busy} className="text-xs font-semibold text-emerald-800" onClick={() => { setConversationId(""); setInput(""); setSources([]); pending.current = null; }}>新对话</button>
    </div>
    {state.conversations.length ? <select disabled={busy} aria-label="选择历史对话" className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={conversationId ?? ""} onChange={(event) => { setConversationId(event.target.value); setInput(""); setSources([]); pending.current = null; }}>
      <option value="">新的对话</option>{state.conversations.slice().reverse().map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}
    </select> : null}
    {state.researchLocation ? <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600"><p>调研中心：<span className="font-semibold text-slate-900">{state.researchLocation.title}</span></p><p className="break-words">{state.researchLocation.place.city}{state.researchLocation.place.district}{state.researchLocation.place.address}</p><p>要研究别处，可以说出城市和具体店名或地址，再选择新的地点。</p></div> : null}
    <div ref={messagesBox} className="mt-4 max-h-[32rem] space-y-4 overflow-y-auto" aria-live="polite">
      {conversation?.messages.map((message) => <div key={message.id} className={`rounded-xl p-3 text-sm leading-6 ${message.role === "user" ? "ml-6 bg-slate-100" : "mr-2 bg-emerald-50"}`}>
        <p className="mb-1 text-xs font-semibold text-slate-500">{message.role === "user" ? "你" : "小掌柜"}</p><p className="whitespace-pre-wrap break-words">{message.content}</p>
        {message.sources?.length ? <p className="mt-2 text-xs text-slate-500">参考资料：{message.sources.map((item) => item.title).join("、")}</p> : null}
        {message.role === "user" ? <button type="button" className="mt-2 text-xs text-emerald-800 underline underline-offset-4" onClick={() => remember(message)}>保存为长期记忆</button> : null}
        {state.turns.filter((turn) => turn.id === message.turnId && message.role === "user").map((turn) => <TurnProgress key={turn.id} turn={turn} location={state.researchLocation} onConfirmLocation={(sourceId) => void action(async () => { await call("/api/agent/chat/location", { sourceId }); if (!input.trim()) setInput("以已确认地点为中心，继续刚才的周边调研。"); })} disabled={busy || Boolean(active && active.id !== turn.id)} locationDisabled={busy || Boolean(active)} onAction={(name) => void action(async () => { await call(`/api/agent/chat/turns/${turn.id}`, { action: name }); })} />)}
      </div>)}
      {!conversation?.messages.length ? <p className="py-3 text-sm leading-6 text-slate-500">可以让我找回最近的草稿、基于资料写一篇，或一起确定下一步。</p> : null}
    </div>
    {active && active.conversationId !== conversationId ? <button type="button" className="mt-3 text-xs text-emerald-800 underline" onClick={() => setConversationId(active.conversationId)}>另一个对话正在执行，查看进度</button> : null}
    <form className="mt-4" onSubmit={(event) => { event.preventDefault(); void send(); }}>
      <label className="sr-only" htmlFor="agent-message">告诉小掌柜你的诉求</label>
      <textarea id="agent-message" disabled={busy || !ready} className="min-h-24 w-full resize-y rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-emerald-800" maxLength={4000} placeholder="例如：用选中的新品资料，帮我写一篇小红书内容" value={input} onChange={(event) => { setInput(event.target.value); pending.current = null; }} />
      <ChatKnowledgePicker key={state.workspaceId} sources={sources} onChange={(next) => {
        if (state.workspaceId !== scope.current) return;
        setSources(next); pending.current = null;
      }} disabled={busy || Boolean(active)} onError={setError} />
      <div className="mt-3 flex items-center justify-between gap-3"><Link href={primaryHref} className="text-xs text-emerald-800 underline underline-offset-4">继续首页建议的任务</Link><button type="submit" className="rounded-lg bg-[#173e32] px-5 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={!ready || busy || Boolean(active) || !input.trim()}>{busy ? "正在提交…" : active ? "任务执行中" : "发送"}</button></div>
    </form>
    <details className="mt-4 border-t border-slate-100 pt-3 text-xs"><summary className="cursor-pointer text-slate-600">账户记忆（{state.memories.length}）</summary><p className="mt-2 leading-5 text-slate-500">用于续聊和表达偏好，经营事实以已确认档案为准。素材、模板仍留在知识库。</p>
      {state.memories.map((item) => <div className="mt-2 flex items-start justify-between gap-3 rounded-lg bg-slate-50 p-3" key={item.id}><p className="whitespace-pre-wrap leading-5">{item.content}</p><div className="flex shrink-0 gap-3"><button type="button" onClick={() => setMemory(item)}>编辑</button><button type="button" disabled={busy} onClick={() => void action(async () => { await call(`/api/agent/chat/memories/${item.id}`, { sourceMessageId: item.sourceMessageId, content: "" }, "PATCH"); })}>删除</button></div></div>)}
    </details>
    {memory ? <form className="mt-3 rounded-xl border border-emerald-200 p-3" onSubmit={(event) => { event.preventDefault(); void action(async () => { await call(`/api/agent/chat/memories/${memory.id}`, { content: memory.content, sourceMessageId: memory.sourceMessageId }, "PATCH"); setMemory(null); }); }}>
      <label htmlFor="agent-memory" className="text-xs font-semibold">确认以后要记住的内容</label><textarea id="agent-memory" maxLength={500} className="mt-2 min-h-20 w-full rounded-lg border border-slate-200 p-2 text-sm" value={memory.content} onChange={(event) => setMemory({ ...memory, content: event.target.value })} />
      <div className="mt-2 flex gap-4 text-xs"><button type="submit" className="font-semibold text-emerald-800" disabled={busy || !memory.content.trim()}>确认保存</button><button type="button" onClick={() => setMemory(null)}>取消</button></div>
    </form> : null}
    {error ? <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-950" role="alert">{error}</p> : null}
  </section>;
}
function TurnProgress({ turn, disabled, onAction, location, onConfirmLocation, locationDisabled }: { turn: ChatTurn; disabled: boolean; location?: ResearchLocation; onConfirmLocation: (sourceId: string) => void; locationDisabled: boolean; onAction: (name: "continue" | "pause") => void }) {
  const results = turn.tools.filter((item) => item.status === "succeeded" && (["create_draft", "read_content"].includes(item.name)) && typeof (item.output?.projectId ?? item.output?.id) === "string");
  const research = [...new Map(turn.tools.filter((item) => item.status === "succeeded" && item.output?.research).map((item) => {
    const record = item.output!.research as ResearchRecord; return [record.id, record] as const;
  })).values()];
  return <div className="mt-3 border-t border-slate-200/70 pt-2 text-xs text-slate-600"><p>{turn.stage}</p>
    {turn.error ? <p className="mt-1 text-amber-800">{turn.error}</p> : null}
    {turn.tools.length ? <details className="mt-2"><summary className="cursor-pointer">查看执行记录（{turn.tools.length}）</summary><ul className="mt-2 space-y-1">{turn.tools.map((item) => <li key={item.key}>{toolLabels[item.name] ?? item.name} · {item.status === "succeeded" ? "已完成" : item.status === "failed" ? "未完成" : "处理中"}</li>)}</ul></details> : null}
    {results.map((item) => <Link key={item.key} className="mt-2 block font-semibold text-emerald-800 underline" href={`/drafts/${encodeURIComponent(String(item.output!.projectId ?? item.output!.id))}`}>打开草稿：{String(item.output!.title ?? item.output!.topic)}{item.name === "create_draft" ? "（待人工核对）" : ""}</Link>)}
    {research.map((record) => <details key={record.id} className="mt-2 rounded-lg border border-slate-200 bg-white p-3"><summary className="cursor-pointer font-semibold text-emerald-800">查看调研来源（{record.sources.length} 条）</summary>
      <p className="mt-2 break-words">查询：{String(record.query.query ?? record.query.accountId ?? (record.kind === "place_detail" ? "所选地点详情" : "已保存记录"))}</p><p className="mt-1">取得时间：{new Date(record.retrievedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</p>
      {record.kind === "nearby_places" ? <p className="mt-1">范围：以 {String((record.query.center as ResearchLocation | undefined)?.title ?? "已确认地点")} 为中心，{Number(record.query.radiusMeters) / 1000} 公里圆形范围</p> : null}
      {!record.sources.length ? <p className="mt-2">本次没有取得可用来源，可以调整关键词后再查。</p> : null}
      <ul className="mt-2 space-y-3">{record.sources.map((source) => <li key={source.id} className="min-w-0 border-t border-slate-100 pt-2">
        {source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer" className="break-words font-semibold underline">{source.title}</a> : <p className="break-words font-semibold">{source.title}（来源未提供链接）</p>}
        <p className="mt-1">{source.provider === "amap" ? "高德地图" : source.provider === "brave" ? "公开网页" : source.platform === "xiaohongshu" ? "小红书" : "公众号"} · {source.evidence === "place" ? "地点资料" : source.evidence === "snippet" ? "搜索摘要" : source.evidence === "body" ? "正文片段" : source.evidence === "profile" ? "账号资料" : "内容摘要"}{source.authorName ? ` · ${source.authorName}` : ""}</p>
        <p className="mt-1">{source.provider === "amap" ? "地点资料可能滞后，营业情况以门店确认为准" : source.publishedAt ? `来源日期：${sourceDate(source.publishedAt)}` : "来源未提供发布时间"}</p>
        {source.metrics ? <p className="mt-1">{[["点赞", source.metrics.likes], ["收藏", source.metrics.collects], ["评论", source.metrics.comments]].map(([label, value]) => `${label}：${typeof value === "number" ? value : "未知"}`).join(" · ")}</p> : null}
        <p className="mt-1 whitespace-pre-wrap break-words leading-5">{source.text.slice(0, 600) || "来源没有返回内容片段。"}</p>
        {source.place ? <button type="button" disabled={locationDisabled || location?.sourceId === source.id} className="mt-2 rounded-lg border border-emerald-800 px-3 py-2 font-semibold text-emerald-800 disabled:opacity-50" onClick={() => onConfirmLocation(source.id)}>{location?.sourceId === source.id ? "当前调研中心" : "以这里为调研中心"}</button> : null}
      </li>)}</ul><p className="mt-3 leading-5 text-slate-500">{record.limitations.join(" ")}</p>
    </details>)}
    {isActiveTurn(turn) ? <button type="button" disabled={disabled} className="mt-2 underline" onClick={() => onAction("pause")}>暂停后续处理</button> : null}
    {turn.status === "failed" || turn.status === "paused" ? <button type="button" disabled={disabled} className="mt-2 font-semibold text-emerald-800 underline disabled:opacity-40" onClick={() => onAction("continue")}>继续处理</button> : null}
  </div>;
}
function sourceDate(value: string) {
  if (!/^(\d{10}|\d{13})$/.test(value)) return value;
  return new Date(Number(value) * (value.length === 10 ? 1000 : 1)).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
}
const toolLabels: Record<string, string> = { get_business_context: "读取经营资料", search_content: "查找历史内容", read_content: "读取正文", search_knowledge: "检索知识资料", read_knowledge: "读取知识文件", search_conversation: "查找历史对话", load_skill: "加载处理方法", create_draft: "写作与审核", request_input: "等待补充", search_web: "搜索公开网页", search_peer_content: "查询同行内容", read_peer_account: "查询平台账号资料", read_peer_posts: "查询账号近期作品", search_research: "查找历史调研", read_research: "读取历史来源", search_places: "查找调研地点", search_nearby_places: "查询附近门店", read_place: "查询地点详情" };
class RequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
async function call(url: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
  const response = await fetch(url, { method, cache: "no-store", headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new RequestError(data.error || "服务暂时不可用，请刷新后重试。", response.status);
  return data;
}
