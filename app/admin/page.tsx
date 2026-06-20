import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isSiteAdminFromMetadata } from "@/lib/admin";
import AdminModerationPanel from "@/components/admin-moderation-panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect_url=/admin");
  }

  const user = await currentUser();
  const isAdmin = isSiteAdminFromMetadata(
    user?.publicMetadata,
    user?.primaryEmailAddress?.emailAddress
  );

  if (!isAdmin) {
    redirect("/");
  }

  const displayName =
    user?.fullName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    "Site Admin";

  return (
    <div className="min-h-screen bg-[#0b0c0f] text-white">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-300">
              Apex Drive Operations
            </p>
            <h1 className="text-2xl font-bold mt-1">Admin Moderation</h1>
            <p className="text-sm text-gray-400 mt-2">
              Signed in as {displayName}. Review community route submissions before they go live.
            </p>
          </div>
          <a
            href="/"
            className="inline-flex items-center justify-center bg-white/[0.04] border border-white/10 text-gray-200 font-bold py-2.5 px-4 rounded-xl text-xs font-mono uppercase tracking-wider hover:border-white/20 transition-all min-h-[44px]"
          >
            Back To Dashboard
          </a>
        </div>

        <AdminModerationPanel />
      </div>
    </div>
  );
}
