"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell, PageHeader, primaryButtonClass, secondaryButtonClass } from "@/components/app-shell";

const initialForm = { platform: "小红书", sourceUrl: "", title: "", metrics: "", sourceKeyword: "", content: "" };

export default function NewInspirationPage() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/inspirations/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const payload = (await response.json()) as { record?: { id: string }; error?: string };
      if (!response.ok || !payload.record) throw new Error(payload.error ?? "爆款拆解失败");
      router.push(`/inspirations/${payload.record.id}`);
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "爆款拆解失败"); }
    finally { setBusy(false); }
  }

  return (
    <AppShell active="/inspirations">
      <PageHeader eyebrow="ADD VIRAL SAMPLE" title="录入并拆解爆款" description="插件和手工录入最终都会进入同一个爆款库。系统会自动继承当前账号定位。" actions={<button className={secondaryButtonClass} onClick={() => router.push("/inspirations")}>取消</button>} />
      <section className="mt-7 grid gap-5 xl:grid-cols-[1fr_0.65fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="平台" required value={form.platform} onChange={(value) => setForm({ ...form, platform: value })} placeholder="小红书 / 公众号 / 视频号" />
            <Field label="来源关键词" value={form.sourceKeyword} onChange={(value) => setForm({ ...form, sourceKeyword: value })} placeholder="例如：装修避坑" />
            <div className="sm:col-span-2"><Field label="标题" required value={form.title} onChange={(value) => setForm({ ...form, title: value })} placeholder="粘贴原始标题" /></div>
            <div className="sm:col-span-2"><Field label="原文链接" value={form.sourceUrl} onChange={(value) => setForm({ ...form, sourceUrl: value })} placeholder="可选，粘贴网页链接" /></div>
            <div className="sm:col-span-2"><Field label="原始数据" value={form.metrics} onChange={(value) => setForm({ ...form, metrics: value })} placeholder="例如：阅读 2.4 万，点赞 3200，收藏 980，评论 126" /></div>
            <label className="grid gap-2 text-sm font-medium text-slate-700 sm:col-span-2"><span>正文或摘要 <span className="text-rose-600">*</span></span><textarea className="resize-none rounded-xl border border-slate-200 px-3 py-3 leading-6 outline-none focus:border-emerald-700" rows={12} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="粘贴正文、OCR 文本或你记录的内容结构" /></label>
          </div>
          {error ? <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
          <button className={`${primaryButtonClass} mt-6 w-full sm:w-auto`} disabled={busy} onClick={analyze}>{busy ? "AI 正在拆解…" : "拆解并存入爆款库"}</button>
        </div>
        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-semibold tracking-[0.15em] text-emerald-700">插件工作方式</p><h2 className="mt-3 text-lg font-semibold">打开原文，一键采集</h2><p className="mt-3 text-sm leading-6 text-slate-500">Chrome 插件负责读取你当前登录后能看到的页面内容，并自动填入标题、链接和正文。它不会改变后续拆解流程。</p><div className="mt-6 rounded-2xl bg-[#f5f6f3] p-4 text-xs leading-6 text-slate-600">当前可以先手工粘贴完成主流程验证。插件采集结果会进入同一个接口。</div></aside>
      </section>
    </AppShell>
  );
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean }) { return <label className="grid gap-2 text-sm font-medium text-slate-700"><span>{label}{required ? <span className="text-rose-600"> *</span> : null}</span><input className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-700" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>; }

