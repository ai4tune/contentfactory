"use client";

import NextLink, { useLinkStatus } from "next/link";
import { useEffect, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { PageLoadingNotice } from "@/components/loading-feedback";

export default function NavigationLink({ children, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink {...props}>{children}<PendingNotice /></NextLink>;
}

function PendingNotice() {
  const { pending } = useLinkStatus();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setVisible(true), 200);
    return () => { clearTimeout(timer); setVisible(false); };
  }, [pending]);
  return pending && visible ? createPortal(<PageLoadingNotice />, document.body) : null;
}
