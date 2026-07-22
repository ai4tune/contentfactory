import Link from "next/link";
import type { ReactNode } from "react";

const navItems = [
  { label: "首页", href: "/", mark: "首" },
  { label: "内容创作", href: "/create", mark: "创" },
  { label: "当前账号", href: "/positioning", mark: "账" },
  { label: "知识库", href: "/knowledge", mark: "知" },
  { label: "草稿历史", href: "/drafts", mark: "稿" },
];

export function AppShell({
  active,
  children,
}: {
  active: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f5f6f3] text-slate-950">
      <div className="mx-auto grid min-h-screen w-full max-w-[1480px] lg:grid-cols-[248px_1fr]">
        <aside className="min-w-0 border-b border-slate-200 bg-[#12231d] px-5 py-5 text-white lg:min-h-screen lg:border-b-0 lg:border-r lg:border-white/10 lg:px-6 lg:py-7">
          <Link className="flex items-center gap-3" href="/">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-[#dfb967] text-lg font-bold text-[#12231d]">C</span>
            <span>
              <span className="block text-base font-semibold tracking-wide">内容工厂</span>
              <span className="mt-0.5 block text-[11px] tracking-[0.18em] text-white/45">CONTENT OS</span>
            </span>
          </Link>

          <nav className="mt-6 flex gap-2 overflow-x-auto pb-1 lg:mt-10 lg:block lg:space-y-1.5 lg:overflow-visible">
            {navItems.map((item) => {
              const selected = active === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    selected
                      ? "bg-white text-[#12231d] shadow-sm"
                      : "text-white/65 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <span className={`flex size-7 items-center justify-center rounded-lg text-sm ${selected ? "bg-[#f3e8cf]" : "bg-white/8"}`}>
                    {item.mark}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-10 hidden rounded-2xl border border-white/10 bg-white/5 p-4 lg:block">
            <p className="text-xs font-semibold tracking-wide text-[#dfb967]">主流程</p>
            <p className="mt-2 text-xs leading-5 text-white/55">确定选题 → 选择知识 → 生成渠道内容 → 审核发布</p>
          </div>
        </aside>

        <div className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</div>
      </div>
    </main>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="text-xs font-semibold tracking-[0.16em] text-emerald-700">{eyebrow}</p> : null}
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export const primaryButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl bg-[#173e32] px-4 text-sm font-semibold text-white transition hover:bg-[#0e2d24] disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50";
