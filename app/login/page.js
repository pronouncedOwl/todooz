import LoginForm from "@/components/LoginForm";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = {
  title: "Sign in · Toodooz",
};

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const nextPath =
    typeof params?.next === "string" && params.next.startsWith("/")
      ? params.next
      : "/";

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-sm px-4 py-16 text-sm text-muted sm:px-6">
        <p className="mb-2 text-[15px] font-semibold text-ink">Toodooz</p>
        <p>
          Auth needs{" "}
          <code className="text-ink">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="text-ink">
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
          </code>{" "}
          (or the legacy anon key) in your environment.
        </p>
      </div>
    );
  }

  return <LoginForm nextPath={nextPath} />;
}
