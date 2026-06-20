import { SignIn } from "@clerk/nextjs";
import { AuthPageShell } from "@/components/auth-page-shell";
import { clerkAuthAppearance } from "@/lib/clerk-auth-appearance";

export default function SignInPage() {
  return (
    <AuthPageShell mode="sign-in">
      <SignIn
        path="/sign-in"
        routing="path"
        oidcPrompt="select_account"
        signUpUrl="/sign-up"
        appearance={clerkAuthAppearance}
      />
    </AuthPageShell>
  );
}
