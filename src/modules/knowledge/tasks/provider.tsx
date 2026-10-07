"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "@/components/navigation-link";
import { usePathname } from "next/navigation";
import { isKnowledgeTaskActive, type KnowledgeTask } from "./types";

const TasksContext = createContext<{ tasks: KnowledgeTask[]; refresh: () => Promise<void> }>({ tasks: [], refresh: async () => {} });
export const useKnowledgeTasks = () => useContext(TasksContext);

export function KnowledgeTasksProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const enabled = !["/login", "/forgot-password", "/set-password", "/access-denied"].includes(pathname);
  const [tasks, setTasks] = useState<KnowledgeTask[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const value: unknown = JSON.parse(localStorage.getItem("knowledge-task-dismissed") ?? "[]");
      return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    } catch { return []; }
  });
  const [now, setNow] = useState(() => Date.now());
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [connectionLost, setConnectionLost] = useState(false);
  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const response = await fetch("/api/knowledge/tasks", { cache: "no-store" });
      if (response.status === 401 || response.status === 403) { setTasks([]); return; }
      if (!response.ok) throw new Error("status unavailable");
      const payload = await response.json() as { tasks: KnowledgeTask[] };
      setTasks(payload.tasks);
      setConnectionLost(false);
    } catch { setConnectionLost(true); }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const initial = setTimeout(() => { void refresh(); }, 0);
    const interval = setInterval(() => { setNow(Date.now()); void refresh(); }, 5_000);
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => { clearTimeout(initial); clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [enabled, refresh]);

  const task = enabled ? tasks.find(isKnowledgeTaskActive) ?? tasks.find((item) =>
    !dismissed.includes(`${item.id}:${item.attempt}`) && now - Date.parse(item.updatedAt) < 86_400_000) : undefined;
  const active = task && isKnowledgeTaskActive(task);
  const elapsed = task ? Math.max(0, Math.floor((now - Date.parse(task.createdAt)) / 60_000)) : 0;

  async function retry() {
    if (!task) return;
    setRetrying(true); setRetryError(null);
    try {
      const response = await fetch(`/api/knowledge/tasks/${task.id}/retry`, { method: "POST" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "重试提交失败，请稍后再试。");
      await refresh();
    } catch (error) { setRetryError(error instanceof Error ? error.message : "重试提交失败。"); }
    finally { setRetrying(false); }
  }

  function dismiss() {
    if (!task) return;
    const next = [...dismissed, `${task.id}:${task.attempt}`].slice(-100);
    setDismissed(next);
    try { localStorage.setItem("knowledge-task-dismissed", JSON.stringify(next)); } catch { /* Notification can still be dismissed for this visit. */ }
  }

  return <TasksContext.Provider value={{ tasks, refresh }}>
    {children}
    {task ? <aside aria-label="知识库后台任务" className="fixed bottom-4 right-4 z-40 w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-emerald-200 bg-white p-5 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <p role="status" className="text-sm font-semibold text-slate-900">{task.kind === "profile" ? "企业知识档案" : "目录整理建议"} · {active ? "后台处理中" : task.status === "succeeded" ? "已完成" : "需要重试"}</p>
        {active ? <button onClick={() => setCollapsed((value) => !value)} aria-expanded={!collapsed} className="shrink-0 text-sm text-slate-500">{collapsed ? "展开" : "收起"}</button>
          : <button onClick={dismiss} aria-label="关闭任务提醒" className="text-sm text-slate-500">关闭</button>}
      </div>
      {!active || !collapsed ? <p className="mt-2 text-sm text-slate-700">{task.stage}</p> : null}
      {active ? collapsed ? null : <>
        <progress aria-label="资料批次进度" max={task.totalBatches} value={task.completedBatches} className="mt-3 h-2 w-full accent-emerald-700" />
        <p className="mt-2 text-xs leading-5 text-slate-500">已保存 {task.completedBatches}/{task.totalBatches} 批 · {task.sourceCount} 份资料 · 已等待 {elapsed < 1 ? "不足 1" : elapsed} 分钟</p>
        <p className="text-xs leading-5 text-slate-500">参考耗时 {task.estimatedMinutes.min}–{task.estimatedMinutes.max} 分钟，按资料量估算；重试可能延长。{elapsed > task.estimatedMinutes.max ? "当前已超过参考时间，后台仍在处理。" : ""}</p>
        <p className="mt-2 text-xs leading-5 text-emerald-800">可以离开页面、刷新或关闭浏览器。完成后在站内提醒；换设备登录同一客户空间可查看结果。</p>
        {connectionLost ? <p className="mt-2 text-xs text-amber-800">暂时无法更新进度，恢复连接后会重新查询。</p> : null}
      </> : task.status === "succeeded" ? <>
        <Link className="mt-3 inline-block text-sm font-semibold text-emerald-800 underline" href={task.kind === "profile" ? "/knowledge/profile" : `/knowledge?task=${task.id}`}>查看并确认结果</Link>
        {task.kind === "organization" ? <p className="mt-2 text-xs text-slate-500">创建整理副本需回到原电脑，恢复文件夹权限后确认。</p> : null}
      </> : <>
        <p className="mt-2 text-xs leading-5 text-amber-800">{task.error}</p>
        <button disabled={retrying} onClick={retry} className="mt-3 text-sm font-semibold text-emerald-800 underline disabled:opacity-50">{retrying ? "提交中…" : "继续重试"}</button>
        {retryError ? <p role="alert" className="mt-2 text-xs text-red-700">{retryError}</p> : null}
      </>}
    </aside> : null}
  </TasksContext.Provider>;
}
