import type {
  StyleContract,
  StyleContractRule,
  StyleProfile,
  StyleRule,
} from "./types";

export function compileStyleContract(
  profile: StyleProfile,
  options: { temporaryInstructions?: string[] } = {},
): StyleContract {
  const sourceTitles = new Map(profile.sources.map((source) => [source.id, source.title]));
  const rules = profile.rules.map((rule) => toContractRule(rule, sourceTitles));
  const temporaryInstructions = Array.from(new Set(
    (options.temporaryInstructions ?? []).map((item) => item.trim()).filter(Boolean),
  )).slice(0, 12);

  return {
    profileId: profile.id,
    profileVersion: profile.version,
    profileName: profile.name,
    mode: temporaryInstructions.length ? "temporary" : "default",
    persona: profile.persona,
    readerRelationship: profile.readerRelationship,
    values: [...profile.values],
    tone: [...profile.tone],
    hardRules: rules.filter((rule) => rule.priority === "hard"),
    softRules: rules.filter((rule) => rule.priority === "soft"),
    preferredPhrases: [...profile.preferredPhrases],
    bannedPhrases: [...profile.bannedPhrases],
    channelOverrides: Object.fromEntries(
      Object.entries(profile.channelOverrides).map(([channel, channelRules]) => [channel, [...channelRules]]),
    ),
    examples: profile.examples.slice(0, 5).map(({ id, ...example }) => {
      void id;
      return { ...example, sourceTitle: sourceTitles.get(example.sourceId) ?? example.sourceId };
    }),
    temporaryInstructions,
    compiledAt: new Date().toISOString(),
  };
}

function toContractRule(
  rule: StyleRule,
  sourceTitles: Map<string, string>,
): StyleContractRule {
  return {
    category: rule.category,
    priority: rule.priority,
    instruction: rule.instruction,
    evidence: rule.evidence.map((evidence) => ({
      ...evidence,
      sourceTitle: sourceTitles.get(evidence.sourceId) ?? evidence.sourceId,
    })),
  };
}
