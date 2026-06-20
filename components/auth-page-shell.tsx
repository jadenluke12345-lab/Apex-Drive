import { Zap } from "lucide-react";
import Link from "next/link";

type AuthMode = "sign-in" | "sign-up";

export function AuthPageShell({
  mode,
  children,
  footer,
}: {
  mode: AuthMode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="min-h-[100dvh] w-full bg-[#0d0e10] overflow-y-auto">
      <div className="w-full max-w-md mx-auto flex flex-col items-center gap-4 px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-white shrink-0"
        >
          <Zap className="h-6 w-6 text-[#00F2FE]" aria-hidden />
          <span className="text-2xl font-black tracking-tight">
            APEX<span className="text-[#00F2FE]">DRIVE</span>
          </span>
        </Link>

        <div className="w-full bg-[#111215] border border-white/10 rounded-xl p-2 flex items-center gap-2 shrink-0">
          <Link
            href="/sign-in"
            className={
              mode === "sign-in"
                ? "flex-1 rounded-lg bg-[#00F2FE] text-black text-center text-xs font-mono uppercase font-bold py-2.5 min-h-[44px] flex items-center justify-center"
                : "flex-1 rounded-lg bg-white/[0.04] border border-white/10 text-gray-300 text-center text-xs font-mono uppercase font-bold py-2.5 min-h-[44px] flex items-center justify-center hover:text-white"
            }
          >
            Log In
          </Link>
          <Link
            href="/sign-up"
            className={
              mode === "sign-up"
                ? "flex-1 rounded-lg bg-[#00F2FE] text-black text-center text-xs font-mono uppercase font-bold py-2.5 min-h-[44px] flex items-center justify-center"
                : "flex-1 rounded-lg bg-white/[0.04] border border-white/10 text-gray-300 text-center text-xs font-mono uppercase font-bold py-2.5 min-h-[44px] flex items-center justify-center hover:text-white"
            }
          >
            Sign Up
          </Link>
        </div>

        <div className="w-full">{children}</div>

        {footer}
      </div>
    </main>
  );
}
