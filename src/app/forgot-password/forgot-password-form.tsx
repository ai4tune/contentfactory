"use client";

import { FormEvent, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { LoadingSpinner } from "@/components/loading-feedback";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const redirectTo = `${window.location.origin}/auth/confirm?next=/set-password`;
      const { error } = await createBrowserSupabaseClient().auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
      setSent(true);
    } catch {
      setMessage("暂时无法发送邮件，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-8 rounded-2xl bg-emerald-50 px-5 py-4 text-sm leading-6 text-emerald-800" role="status">
        如果该邮箱已加入内容工厂，你将收到一封重置密码邮件。请注意查看垃圾邮件。
      </div>
    );
  }

  return (
    <form aria-busy={busy} className="mt-8 space-y-5" onSubmit={submit}>
      <label className="block text-sm font-medium text-slate-700">
        登录邮箱
        <input
          autoComplete="email"
          autoFocus
          className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 outline-none transition focus:border-emerald-700"
          inputMode="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
          required
          type="email"
          value={email}
        />
      </label>
      {message ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{message}</p> : null}
      <button
        className="min-h-12 w-full rounded-xl bg-[#173e32] px-4 text-sm font-semibold text-white transition hover:bg-[#0e2d24] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy}
        type="submit"
      >
        {busy ? <span role="status" className="inline-flex items-center gap-2"><LoadingSpinner />正在发送，请稍候…</span> : "发送重置邮件"}
      </button>
    </form>
  );
}
