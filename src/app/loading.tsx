import { PageLoadingNotice } from "@/components/loading-feedback";

export default function Loading() {
  return <div className="min-h-screen bg-[#f5f6f3]" aria-busy="true"><PageLoadingNotice /></div>;
}
