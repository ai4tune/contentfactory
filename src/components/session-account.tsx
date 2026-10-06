"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function SessionAccount() {
  const [email, setEmail] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let userId: string | null | undefined;
    const { data: { subscription } } = createBrowserSupabaseClient().auth.onAuthStateChange((_event, session) => {
      const next = session?.user.id ?? null;
      if (userId !== undefined && userId !== next) window.location.reload();
      userId = next;
    });
    void fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (response.ok) setEmail((await response.json()).email ?? ""); })
      .catch(() => undefined);
    return () => { controller.abort(); subscription.unsubscribe(); };
  }, []);
  return <>
    <p className="break-all px-3 text-xs text-white/65">{email}</p>
    <p className="mt-1 px-3 text-[11px] text-white/45">独立账号空间</p>
  </>;
}
