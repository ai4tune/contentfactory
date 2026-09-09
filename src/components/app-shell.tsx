import Link from "next/link";
import type { ReactNode } from "react";

type NavItem = {
  label: string;
  href: string;
  mark: string;
  description?: string;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    label: "内容增长",
    items: [
      { label: "首页", href: "/", mark: "首", description: "运营总览" },
      { label: "市场雷达", href: "/radar", mark: "雷", description: "外部市场正在发生什么" },
      { label: "灵感与选题", href: "/ideas", mark: "灵", description: "什么值得写" },
    ],
  },
  {
    label: "内容生产",
    items: [
      { label: "内容工厂", href: "/create", mark: "创", description: "怎么把选题变成内容" },
      { label: "内容项目", href: "/drafts", mark: "稿", description: "当前生产到哪里" },
      { label: "内容库", href: "/articles", mark: "库", description: "已经生产和发布了什么" },
    ],
  },
  {
    label: "企业资产",
    items: [
      { label: "企业知识库", href: "/knowledge", mark: "知", description: "企业有哪些内容资产" },
      { label: "账号与品牌", href: "/brand", mark: "品", description: "我是谁、写给谁、怎么表达" },
    ],
  },
  // TODO: V2 后续阶段开放以下导航
  // {
  //   label: "AI 能力",
  //   items: [
  //     { label: "AI 员工", href: "/ai/agent", mark: "AI", description: "用自然语言完成复杂工作" },
  //     { label: "Skill 中心", href: "/ai/skills", mark: "技", description: "系统拥有哪些能力" },
  //     { label: "自动任务", href: "/ai/automations", mark: "自", description: "哪些工作不需要人工触发" },
  //   ],
  // },
  // {
  //   label: "运营",
  //   items: [
  //     { label: "运营复盘", href: "/analytics", mark: "复", description: "什么内容真正有效" },
  //   ],
  // },
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

          <nav className="mt-6 flex gap-2 overflow-x-auto pb-1 lg:mt-8 lg:block lg:overflow-visible">
            {navSections.map((section, sectionIndex) => (
              <div key={section.label} className={sectionIndex > 0 ? "mt-4" : ""}>
                <p className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35 lg:block lg:px-3 lg:pb-1.5">
                  {section.label}
                </p>
                <div className="flex gap-1 lg:block lg:space-y-0.5">
                  {section.items.map((item) => {
                    const selected = active === item.href;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                          selected
                            ? "bg-white text-[#12231d] shadow-sm"
                            : "text-white/65 hover:bg-white/8 hover:text-white"
                        }`}
                      >
                        <span className={`flex size-6 items-center justify-center rounded-lg text-xs ${selected ? "bg-[#f3e8cf]" : "bg-white/8"}`}>
                          {item.mark}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate">{item.label}</span>
                          {item.description && selected && (
                            <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                              {item.description}
                            </span>
                          )}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-8 hidden rounded-2xl border border-white/10 bg-white/5 p-4 lg:block">
            <p className="text-xs font-semibold tracking-wide text-[#dfb967]">核心闭环</p>
            <p className="mt-2 text-xs leading-5 text-white/55">市场找机会 → 企业找证据 → AI做内容 → 数据做复盘</p>
          </div>

          {/* TODO: 设置页开发后开放
          <div className="mt-4 hidden rounded-2xl border border-white/10 bg-white/5 p-4 lg:block">
            <Link className="flex items-center gap-2 text-xs text-white/50 hover:text-white/80" href="/settings">
              <span className="flex size-5 items-center justify-center rounded-lg bg-white/8 text-[10px]">设</span>
              设置
            </Link>
          </div>
          */}
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
