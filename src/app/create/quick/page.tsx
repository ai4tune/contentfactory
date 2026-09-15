import { redirect } from "next/navigation";

export default async function QuickCreateBridge({
  searchParams,
}: {
  searchParams: Promise<{ planId?: string; planItemId?: string; title?: string }>;
}) {
  const values = await searchParams;
  const query = new URLSearchParams({ entry: "quick" });
  if (values.planId) query.set("planId", values.planId);
  if (values.planItemId) query.set("planItemId", values.planItemId);
  if (values.title) query.set("title", values.title);
  redirect(`/create?${query.toString()}`);
}
