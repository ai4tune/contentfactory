"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import Link from "@/components/navigation-link";

export function SessionAccount() {
  const [email, setEmail] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let userId: string | null | undefined;
    const { data: { subscription } } = createBrowserSupabaseClient().auth.onAuthStateChange((_event, session) => {
      const next = session?.user.id ?? null;
      if (userId !== undefined && userId !== next) window.location.reload();
      userId = next;
    });
    void fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const session = await response.json();
        setEmail(session.email ?? "");
        setIsOwner(session.role === "owner");
      })
      .catch(() => undefined);
    return () => { controller.abort(); subscription.unsubscribe(); };
  }, []);
  return <>
    <p className="break-all px-3 text-xs text-white/65">{email}</p>
    <p className="mt-1 px-3 text-[11px] text-white/45">独立账号空间</p>
    {isOwner ? <Link href="/operations/invitations" className="mt-3 block rounded-xl px-3 py-2 text-xs font-semibold text-white/65 transition hover:bg-white/8 hover:text-white">邀请用户</Link> : null}
  </>;
}
