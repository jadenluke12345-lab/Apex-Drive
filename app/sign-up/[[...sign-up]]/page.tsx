import { SignUp } from "@clerk/nextjs";
import { AuthPageShell } from "@/components/auth-page-shell";
import { clerkAuthAppearance } from "@/lib/clerk-auth-appearance";

export default function SignUpPage() {
  return (
    <AuthPageShell
      mode="sign-up"
      footer={
        <p className="text-xs text-gray-400 max-w-md text-center">
          Complete email verification after signup to unlock Apex Drive.
        </p>
      }
    >
      <SignUp
        path="/sign-up"
        routing="path"
        oidcPrompt="select_account"
        signInUrl="/sign-in"
        appearance={clerkAuthAppearance}
      />
    </AuthPageShell>
  );
}
