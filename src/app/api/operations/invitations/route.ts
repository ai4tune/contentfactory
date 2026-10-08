import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceMembership } from "@/lib/supabase/authorization";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { contentFactoryWorkspaceId } from "@/lib/supabase/config";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if ((await getWorkspaceMembership())?.role !== "owner") {
    return NextResponse.json({ error: "仅管理员可以邀请用户。" }, { status: 403 });
  }
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const protocol = request.headers.get("x-forwarded-proto") === "https" ? "https:" : request.nextUrl.protocol;
  const siteOrigin = `${protocol}//${host}`;
  if (origin && origin !== siteOrigin) {
    return NextResponse.json({ error: "请从内容工厂页面发送邀请。" }, { status: 403 });
  }
  const input = await request.json().catch(() => null);
  const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "请输入有效的邮箱地址。" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteOrigin}/auth/confirm?next=/set-password`,
  });
  let user = data.user;
  const emailSent = !error && Boolean(user);
  if (error?.code === "email_exists" || error?.code === "user_already_exists") {
    // Confirmed users cannot be re-invited. Locate only the requested email to repair access.
    for (let page = 1; ; page++) {
      const result = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (result.error) break;
      user = result.data.users.find((candidate) => candidate.email?.toLowerCase() === email) ?? null;
      if (user || result.data.users.length < 1000) break;
    }
  }
  if (!user) {
    const limited = error?.status === 429;
    return NextResponse.json({ error: limited ? "发送过于频繁，请稍后重试。" : "邀请邮件发送失败，请稍后重试。" }, { status: limited ? 429 : 502 });
  }

  const workspaceId = contentFactoryWorkspaceId();
  const grant = await supabase.from("content_factory_workspace_members").upsert({
    workspace_id: workspaceId, user_id: user.id, role: "member",
  }, { onConflict: "workspace_id,user_id", ignoreDuplicates: true });
  const membership = grant.error ? null : await supabase.from("content_factory_workspace_members")
    .select("role").eq("workspace_id", workspaceId).eq("user_id", user.id).maybeSingle();
  if (grant.error || membership?.error || !membership?.data) {
    return NextResponse.json({ emailSent, error: emailSent
      ? "邮件已发送，但成员权限开通失败。请用同一邮箱重试以补齐权限。"
      : "该邮箱已注册，但成员权限开通失败。请用同一邮箱重试。" }, { status: 502 });
  }
  return NextResponse.json({ email, emailSent, role: membership.data.role, message: emailSent
    ? `邀请邮件已发送至 ${email}，访问权限已开通。请提醒用户查看垃圾邮件，并尽快打开邮件设置密码。`
    : `${email} 已注册，访问权限已确认，可直接登录内容工厂。` }, { headers: { "Cache-Control": "no-store" } });
}
