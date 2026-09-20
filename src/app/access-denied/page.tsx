export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f6f3] px-4">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-950">这个账号还没有开通</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">登录已经成功，但账号尚未加入当前客户空间。请联系管理员完成开通。</p>
        <form action="/api/auth/signout" className="mt-6" method="post">
          <button className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700" type="submit">退出并更换账号</button>
        </form>
      </section>
    </main>
  );
}
