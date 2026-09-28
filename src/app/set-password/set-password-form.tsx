"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function SetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (password.length < 8) {
      setMessage("密码至少需要 8 个字符。");
      return;
    }
    if (password !== confirmation) {
      setMessage("两次输入的密码不一致。");
      return;
    }

    setBusy(true);
    try {
      const { error } = await createBrowserSupabaseClient().auth.updateUser({ password });
      if (error) throw error;
      router.replace("/");
      router.refresh();
    } catch {
      setMessage("链接无效或已过期，请重新发送密码邮件。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={submit}>
      <label className="block text-sm font-medium text-slate-700">
        新密码
        <input
          autoComplete="new-password"
          autoFocus
          className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 outline-none transition focus:border-emerald-700"
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        再次输入新密码
        <input
          autoComplete="new-password"
          className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 outline-none transition focus:border-emerald-700"
          minLength={8}
          onChange={(event) => setConfirmation(event.target.value)}
          required
          type="password"
          value={confirmation}
        />
      </label>
      {message ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700" role="alert">
          <p>{message}</p>
          <Link className="mt-1 inline-block font-semibold underline" href="/forgot-password">重新发送邮件</Link>
        </div>
      ) : null}
      <button
        className="min-h-12 w-full rounded-xl bg-[#173e32] px-4 text-sm font-semibold text-white transition hover:bg-[#0e2d24] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy}
        type="submit"
      >
        {busy ? "正在保存…" : "保存密码并进入内容工厂"}
      </button>
    </form>
  );
}
