import type { StyleProfileInput } from "./types";

export function manualStyleProfile(name: string, description: string, sample: string, current: StyleProfileInput | null): StyleProfileInput {
  const sourceId = "user-written-style";
  return {
    ...current,
    starterTemplate: undefined,
    name: `${name} · 自定义风格`,
    persona: current?.persona ?? "以当前品牌介绍者的视角表达，口吻不提供身份或经历事实。",
    readerRelationship: current?.readerRelationship ?? "向读者清楚介绍真实信息",
    values: current?.values ?? ["真实", "清楚"], tone: current?.tone ?? [],
    rules: [...(current?.rules.filter((rule) => rule.id !== sourceId) ?? []), {
      id: sourceId, category: "language", priority: "hard", instruction: description.trim(),
      evidence: [{ sourceId, excerpt: description.trim(), note: "用户亲自填写的风格要求。" }],
    }],
    preferredPhrases: current?.preferredPhrases ?? [], bannedPhrases: current?.bannedPhrases ?? [],
    channelOverrides: current?.channelOverrides ?? {},
    examples: [...(current?.examples.filter((example) => example.id !== sourceId) ?? []), {
      id: sourceId, sourceId, title: sample.trim() ? "用户提供的表达示例" : "用户的表达要求",
      excerpt: sample.trim() || description.trim(), purpose: "只学习表达，不作为品牌事实或亲历依据。",
    }],
    sources: [...(current?.sources.filter((source) => source.id !== sourceId) ?? []), {
      id: sourceId, title: "用户录入的风格与示例", sourceType: "manual", role: "style_guide",
    }],
  };
}
