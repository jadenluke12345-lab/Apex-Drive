import { UserProfile } from "@clerk/nextjs";

export default function AccountPage() {
  return (
    <main className="min-h-screen w-full bg-[#0d0e10] flex flex-col items-center justify-center gap-4 p-6">
      <UserProfile path="/account" routing="path" />
      <p className="text-xs text-gray-400 text-center max-w-md">
        Verify your email to unlock access. Add a phone number later if you want
        extra account security.
      </p>
    </main>
  );
}
