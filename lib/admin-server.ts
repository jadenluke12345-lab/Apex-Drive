import { auth, currentUser } from "@clerk/nextjs/server";
import { isSiteAdminFromMetadata } from "@/lib/admin";

export async function getAuthenticatedAdminUserId() {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  if (!user) return null;

  const isAdmin = isSiteAdminFromMetadata(
    user.publicMetadata,
    user.primaryEmailAddress?.emailAddress
  );

  if (!isAdmin) return null;
  return userId;
}

export async function requireSiteAdminUserId() {
  const userId = await getAuthenticatedAdminUserId();
  if (!userId) {
    throw new Error("FORBIDDEN");
  }
  return userId;
}
