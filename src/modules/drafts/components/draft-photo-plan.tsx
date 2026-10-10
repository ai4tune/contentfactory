import type { ChannelDraft } from "@/modules/content/types";
import { secondaryButtonClass } from "@/components/app-shell";

export function DraftPhotoPlan({ draft, disabled, busy, onGenerate }: { draft: ChannelDraft; disabled: boolean; busy: boolean; onGenerate: () => void }) {
  const plan = draft.photoPlan;
  const stale = plan && plan.basedOnContentUpdatedAt !== draft.updatedAt;
  return <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-semibold">{draft.channel === "short_video_script" ? "真实拍摄素材" : "建议准备的实拍照片"}</h3><button className={secondaryButtonClass} type="button" disabled={disabled} onClick={onGenerate}>{busy ? "正在准备…" : plan ? "按当前正文重新准备" : "准备实拍清单"}</button></div>
    <p className="mt-2 text-xs leading-5 text-slate-600">使用与本篇内容一致的真实照片。下面是拍摄建议；请核对实际条件，AI 图不能冒充门店或产品实拍。</p>
    {stale ? <p className="mt-3 text-xs font-semibold text-amber-800">正文或标题已修改，这份清单来自上一版本。请重新核对或准备。</p> : null}
    {plan?.suggestions.length ? <div className="mt-4 grid gap-3">{plan.suggestions.map((item, index) => <article className="rounded-xl border border-slate-200 bg-white p-4" key={`${index}:${item.subject}`}>
      <h4 className="text-sm font-semibold">{index + 1}. {item.subject}</h4><dl className="mt-3 grid gap-2 text-xs leading-5">{[["用途", item.purpose], ["怎么拍", item.how], ["放哪里", item.placement], ["缺图怎么办", item.fallback]].map(([label, value]) => <div key={label}><dt className="font-semibold text-slate-500">{label}</dt><dd className="mt-1 text-slate-700">{value}</dd></div>)}</dl>
    </article>)}</div> : <p className="mt-3 text-xs leading-5 text-slate-500">{plan ? "这篇暂未推荐实拍对象。可以先核对文字；需要照片时补充相关真实资料，再准备清单。" : "还没有本篇实拍清单。先保存正文，再让 AI 给出拍什么、怎么拍和放在哪里的建议。"}</p>}
  </section>;
}
