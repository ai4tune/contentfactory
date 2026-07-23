export function normalizeBriefList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap(normalizeItem).filter(isUsableText))];
}

function normalizeItem(value: unknown): string[] {
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text ? [text] : [];
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];

  const record = value as Record<string, unknown>;
  const title = firstText(record.title, record.heading, record.section, record.name);
  const details = [record.summary, record.description, record.content, record.angle, record.keyPoints, record.points, record.items]
    .flatMap((item) => Array.isArray(item) ? item.flatMap(normalizeItem) : normalizeItem(item));
  if (title) return [details.length ? `${title}：${details.join("；")}` : title];

  const fallback = Object.values(record).flatMap(normalizeItem);
  return fallback.length ? [fallback.join("；")] : [];
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (text) return text;
    }
  }
  return "";
}

function isUsableText(value: string) {
  return Boolean(value) && value.toLocaleLowerCase("en-US") !== "[object object]";
}
