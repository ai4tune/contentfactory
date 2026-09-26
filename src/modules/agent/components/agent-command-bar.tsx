"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Resolution = {
  href?: string;
  message?: string;
  actionLabel?: string;
};

export function AgentCommandBar({
  hasConfirmedPlan,
  primaryHref,
}: {
  hasConfirmedPlan: boolean;
  primaryHref: string;
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [response, setResponse] = useState<Resolution | null>(null);

  function runCommand(command: string) {
    const value = command.trim();
    if (!value) return;
    const resolution = resolveCommand(value, { hasConfirmedPlan, primaryHref });
    if (resolution.message) {
      setResponse(resolution);
      return;
    }
    if (resolution.href) {
      router.push(resolution.href);
      return;
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_45px_rgba(23,62,50,0.07)] sm:p-5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          runCommand(input);
        }}
      >
        <label className="block text-sm font-semibold text-slate-900" htmlFor="agent-command">
          告诉 AI 你现在想做什么
        </label>
        <p className="mt-1 text-xs leading-5 text-slate-500">可以直接说目标，不需要先找到对应菜单。</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <textarea
            className="min-h-24 resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-800 focus:bg-white focus:ring-2 focus:ring-emerald-900/10 sm:min-h-12"
            id="agent-command"
            onChange={(event) => {
              setInput(event.target.value);
              if (response) setResponse(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                runCommand(input);
              }
            }}
            placeholder="例如：我想写一篇关于企业 AI 落地的文章"
            value={input}
          />
          <button
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-[#dfb967] px-5 text-sm font-semibold text-[#173e32] transition hover:bg-[#e8c87f] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!input.trim()}
            type="submit"
          >
            继续
          </button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap gap-2" aria-label="常用指令">
        {["我今天应该先做什么", "我有一个新的选题", "查看最近的内容"].map((suggestion) => (
          <button
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-emerald-800/30 hover:bg-emerald-50 hover:text-emerald-900 active:translate-y-px"
            key={suggestion}
            onClick={() => runCommand(suggestion)}
            type="button"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {response ? (
        <div aria-live="polite" className="mt-4 rounded-xl bg-[#f5ecd9] px-4 py-3 text-sm leading-6 text-[#6f551f]">
          <p>{response.message}</p>
          {response.href && response.actionLabel ? (
            <Link className="mt-2 inline-flex font-semibold underline underline-offset-4" href={response.href}>
              {response.actionLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function resolveCommand(
  input: string,
  context: { hasConfirmedPlan: boolean; primaryHref: string },
): Resolution {
  const normalized = input.toLocaleLowerCase("zh-CN");

  if (containsAny(normalized, ["今天", "下一步", "先做", "继续当前"])) {
    return { href: context.primaryHref };
  }
  if (containsAny(normalized, ["视频", "剪辑", "口播"])) {
    return {
      message: "视频工作流正在接入。现在可以先进入高级创作生成短视频脚本，素材匹配和自动剪辑会在后续阶段接上。",
      href: `/create?title=${encodeURIComponent(input)}`,
      actionLabel: "先生成视频脚本",
    };
  }
  if (containsAny(normalized, ["草稿", "审核", "发布", "数据", "最近", "内容库"])) {
    return { href: "/articles" };
  }
  if (normalized === "我有一个新的选题" || normalized === "新选题") {
    return { href: context.hasConfirmedPlan ? "/create" : "/plans" };
  }
  if (containsAny(normalized, ["写", "创作", "初稿", "文案", "文章"])) {
    return {
      href: context.hasConfirmedPlan
        ? `/create?title=${encodeURIComponent(input)}`
        : "/plans",
    };
  }
  if (containsAny(normalized, ["计划", "选题", "本周", "下周", "30天", "30 天"])) {
    return { href: "/plans" };
  }
  if (containsAny(normalized, ["企业", "定位", "资料", "知识", "风格", "品牌"])) {
    return { href: "/brand" };
  }

  return {
    message: "这版工作台先支持计划、选题、创作、审核、企业资料和视频脚本。你也可以直接选择上方建议，我会继续把更多自由指令接进来。",
  };
}

function containsAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}
