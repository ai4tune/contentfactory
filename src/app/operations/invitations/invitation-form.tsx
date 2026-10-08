"use client";

import { useState, type FormEvent } from "react";
import { primaryButtonClass } from "@/components/app-shell";
import { LoadingSpinner } from "@/components/loading-feedback";

export function InvitationForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/operations/invitations", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "邀请未完成，请重试。");
      setMessage(result.message);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "邀请未完成，请重试。");
    } finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="mt-7 max-w-xl rounded-2xl border border-slate-200 bg-white p-6" aria-busy={busy}>
    <label htmlFor="invite-email" className="block text-sm font-semibold text-slate-900">用户邮箱</label>
    <input id="invite-email" name="email" type="email" required maxLength={254} autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-60" />
    <p className="mt-3 text-xs leading-6 text-slate-500">新用户收到邮件后设置密码即可登录。尚未接受邀请的用户可以重新发送；已注册的用户会补齐访问权限，无需重新设置密码。</p>
    <button type="submit" disabled={busy} className={`${primaryButtonClass} mt-5 gap-2`}>{busy ? <><LoadingSpinner />正在发送…</> : "发送邀请"}</button>
    {message ? <p role="status" className="mt-4 text-sm leading-6 text-emerald-800">{message}</p> : null}
    {error ? <p role="alert" className="mt-4 text-sm leading-6 text-red-700">{error}</p> : null}
  </form>;
}
