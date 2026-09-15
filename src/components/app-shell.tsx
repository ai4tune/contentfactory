import Link from "next/link";
import type { ReactNode } from "react";

type NavItem = {
  label: string;
  href: string;
  mark: string;
  description?: string;
};

const primaryNavItems: NavItem[] = [
  { label: "首页", href: "/", mark: "首", description: "今天要完成什么" },
  { label: "内容计划", href: "/plans", mark: "计", description: "未来 30 天写什么" },
  { label: "开始创作", href: "/create/quick", mark: "创", description: "把选题变成内容" },
  { label: "内容库", href: "/articles", mark: "库", description: "审核、发布与数据" },
  { label: "企业资料", href: "/brand", mark: "企", description: "资料、定位与风格" },
];

const advancedNavItems: NavItem[] = [
  { label: "高级创作", href: "/create", mark: "高" },
  { label: "内容项目", href: "/drafts", mark: "稿" },
  { label: "企业知识库", href: "/knowledge", mark: "知" },
  { label: "市场雷达", href: "/radar", mark: "雷" },
  { label: "灵感与选题", href: "/ideas", mark: "灵" },
  { label: "爆款库", href: "/inspirations", mark: "爆" },
  { label: "写作风格", href: "/style-profile", mark: "风" },
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
      <div className="mx-auto grid min-h-screen w-full max-w-[1480px] lg:grid-cols-[268px_1fr]">
        <aside className="min-w-0 border-b border-slate-200 bg-[#12231d] px-5 py-5 text-white lg:min-h-screen lg:border-b-0 lg:border-r lg:border-white/10 lg:px-5 lg:py-7">
          <Link className="flex items-center gap-3" href="/">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-[#dfb967] text-lg font-bold text-[#12231d]">C</span>
            <span>
              <span className="block text-base font-semibold tracking-wide">内容工厂</span>
              <span className="mt-0.5 block text-[11px] tracking-[0.18em] text-white/45">AI GROWTH OS</span>
            </span>
          </Link>

          <nav aria-label="主要功能" className="mt-6 flex gap-1 overflow-x-auto pb-1 lg:mt-8 lg:block lg:space-y-0.5 lg:overflow-visible">
            {primaryNavItems.map((item) => (
              <NavLink active={active} item={item} key={item.href} />
            ))}
          </nav>

          <details className="group mt-3 border-t border-white/10 pt-3" open={advancedNavItems.some((item) => isSelected(active, item.href))}>
            <summary className="cursor-pointer list-none rounded-xl px-3 py-2 text-xs font-semibold text-white/45 transition hover:bg-white/8 hover:text-white/75">
              高级工具 <span aria-hidden="true" className="ml-1 inline-block transition group-open:rotate-90">›</span>
            </summary>
            <div className="mt-1 flex gap-1 overflow-x-auto lg:block lg:space-y-0.5 lg:overflow-visible">
              {advancedNavItems.map((item) => (
                <NavLink active={active} compact item={item} key={item.href} />
              ))}
            </div>
          </details>
        </aside>

        <div className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</div>
      </div>
    </main>
  );
}

function NavLink({
  active,
  compact = false,
  item,
}: {
  active: string;
  compact?: boolean;
  item: NavItem;
}) {
  const selected = isSelected(active, item.href);
  return (
    <Link
      aria-current={selected ? "page" : undefined}
      className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 font-medium transition ${compact ? "text-xs" : "text-sm"} ${
        selected
          ? "bg-white text-[#12231d] shadow-sm"
          : "text-white/65 hover:bg-white/8 hover:text-white"
      }`}
      href={item.href}
    >
      <span className={`flex size-6 items-center justify-center rounded-lg text-xs ${selected ? "bg-[#f3e8cf]" : "bg-white/8"}`}>
        {item.mark}
      </span>
      <span className="min-w-0">
        <span className="block truncate">{item.label}</span>
        {!compact && item.description && selected ? (
          <span className="mt-0.5 block truncate text-[10px] text-slate-500">{item.description}</span>
        ) : null}
      </span>
    </Link>
  );
}

function isSelected(active: string, href: string) {
  return active === href || (href !== "/" && active.startsWith(`${href}/`));
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
