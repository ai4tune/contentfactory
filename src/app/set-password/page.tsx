import { SetPasswordForm } from "./set-password-form";

export default function SetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f6f3] px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-[#dfb967] text-xl font-bold text-[#12231d]">C</div>
        <p className="mt-6 text-xs font-semibold tracking-[0.16em] text-emerald-700">AI CONTENT FACTORY</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">设置登录密码</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">设置后即可使用邮箱和密码登录内容工厂。</p>
        <SetPasswordForm />
      </section>
    </main>
  );
}
