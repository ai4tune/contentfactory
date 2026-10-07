"use client";

import NextLink, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { createPortal } from "react-dom";
import { PageLoadingNotice } from "@/components/loading-feedback";

export default function NavigationLink({ children, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink {...props}>{children}<PendingNotice /></NextLink>;
}

function PendingNotice() {
  const { pending } = useLinkStatus();
  return pending ? createPortal(<PageLoadingNotice />, document.body) : null;
}
