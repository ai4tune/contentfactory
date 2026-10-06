"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(
    searchParams.get("error") === "invalid_link" ? "链接无效或已过期，请重新获取密码邮件。" : null,
  );
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await createBrowserSupabaseClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      const next = searchParams.get("next");
      // Reload all client state when switching identities, including local folder handles.
      window.location.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch {
      setMessage("账号或密码不正确，请检查后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={submit}>
      <label className="block text-sm font-medium text-slate-700">
        登录账号
        <input
          autoComplete="email"
          autoFocus
          className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 outline-none transition focus:border-emerald-700"
          inputMode="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="请输入邮箱账号"
          required
          type="email"
          value={email}
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        密码
        <input
          autoComplete="current-password"
          className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 outline-none transition focus:border-emerald-700"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      {message ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p> : null}
      <button
        className="min-h-12 w-full rounded-xl bg-[#173e32] px-4 text-sm font-semibold text-white transition hover:bg-[#0e2d24] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy}
        type="submit"
      >
        {busy ? "正在登录…" : "登录内容工厂"}
      </button>
      <div className="flex items-center justify-between gap-4 text-xs leading-5">
        <span className="text-slate-400">账号由服务方创建</span>
        <Link className="font-medium text-emerald-700 hover:text-emerald-900" href="/forgot-password">
          忘记密码？
        </Link>
      </div>
    </form>
  );
}
