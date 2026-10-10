"use client";

import { useSyncExternalStore } from "react";
import { defaultTimeZone, localDate } from "./calendar";

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, 60_000);
  return () => clearInterval(timer);
}

export function useLocalDate(serverDate: string, timeZone?: string) {
  return useSyncExternalStore(subscribe, () => localDate(new Date(), timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || defaultTimeZone), () => serverDate);
}
