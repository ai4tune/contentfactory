"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function InspirationEditor({ id, initialBody }: { id: string; initialBody: string }) {
  const router = useRouter();
  const [body, setBody] = useState(initialBody);
  const [savedBody, setSavedBody] = useState(initialBody);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function act(analyze: boolean) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/inspirations/${encodeURIComponent(id)}`, { method: analyze ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, ...(!analyze ? { body: JSON.stringify({ content: body }) } : {}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "操作失败");
      if (!analyze) setSavedBody(body);
      setMessage(analyze ? "拆解完成" : "正文已保存"); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "操作失败"); } finally { setBusy(false); }
  }
  return <section className="mt-5 space-y-3">
    <p className="text-sm text-slate-500">数据源未提供全文时，请从原文复制正文，或使用浏览器插件补充。保存不调用 AI；修改正文后需重新拆解。</p>
    <textarea aria-label="爆款正文" className="min-h-60 w-full rounded-xl border p-4 text-sm leading-7" value={body} disabled={busy} onChange={event => setBody(event.target.value)} />
    <div className="flex flex-wrap gap-3"><button className="rounded-lg border px-4 py-2" disabled={busy || body === savedBody} onClick={() => act(false)}>保存正文</button><button className="rounded-lg bg-emerald-900 px-4 py-2 text-white disabled:opacity-50" disabled={busy || !savedBody.trim() || body !== savedBody} onClick={() => act(true)}>{busy ? "处理中…" : "AI 拆解（消耗算力）"}</button></div>
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
