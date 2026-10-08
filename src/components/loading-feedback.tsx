export function LoadingSpinner() {
  return <span aria-hidden="true" className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />;
}

export function PageLoadingNotice() {
  return (
    <div role="status" className="pointer-events-none fixed right-4 top-4 z-[100] flex items-center gap-2 rounded-lg border border-emerald-900/10 bg-white/95 px-3 py-2 text-xs font-medium text-[#173e32] shadow-sm">
      <LoadingSpinner />
      正在切换…
    </div>
  );
}
