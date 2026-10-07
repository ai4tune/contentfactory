export function LoadingSpinner() {
  return <span aria-hidden="true" className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />;
}

export function PageLoadingNotice() {
  return (
    <div role="status" className="pointer-events-none fixed left-1/2 top-5 z-[100] flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-2xl border border-emerald-900/10 bg-white px-5 py-3 text-sm font-medium text-[#173e32] shadow-lg">
      <LoadingSpinner />
      页面加载中，请稍候…
    </div>
  );
}
