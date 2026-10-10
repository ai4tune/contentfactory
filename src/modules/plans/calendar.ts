import type { ContentPlan, ContentPlanItem } from "./types";

export const defaultTimeZone = "Asia/Shanghai";

export function localDate(now = new Date(), timeZone = defaultTimeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

export function publishingDates(start: string, end: string, frequency: number) {
  const days = daysBetween(start, end) + 1;
  const dates: string[] = [];
  for (let offset = 0; offset < days; offset += 7) {
    const weekDays = Math.min(7, days - offset);
    const count = Math.ceil(weekDays * frequency / 7);
    for (let index = 0; index < count; index++) dates.push(addDays(start, offset + Math.floor(index * weekDays / count)));
  }
  return dates;
}

// Legacy plans have only a week number. Interpret it without writing a date back.
export function itemDate(plan: ContentPlan, item: ContentPlanItem) {
  return item.scheduledDate || addDays(plan.periodStart, (item.week - 1) * 7);
}

export function planWeek(plan: ContentPlan, date: string) {
  return Math.min(Math.ceil((daysBetween(plan.periodStart, plan.periodEnd) + 1) / 7), Math.max(1, Math.floor(daysBetween(plan.periodStart, date) / 7) + 1));
}

export function calendarWeek(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  const start = addDays(date, -(day === 0 ? 6 : day - 1));
  return { start, end: addDays(start, 6) };
}

export function weeklyItems(plan: ContentPlan, date: string) {
  const week = calendarWeek(date);
  return plan.items.filter((item) => {
    if (item.scheduledDate) return item.scheduledDate >= week.start && item.scheduledDate <= week.end;
    const start = itemDate(plan, item);
    const end = [addDays(start, 6), plan.periodEnd].sort()[0];
    return start <= week.end && end >= week.start;
  }).slice().sort((a, b) => itemDate(plan, a).localeCompare(itemDate(plan, b)) || a.priority - b.priority);
}
