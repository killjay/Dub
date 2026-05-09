"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Mode = "sign-in" | "sign-up";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Surface OAuth errors bounced back from /api/auth/google/callback
  useEffect(() => {
    const oauthErr = search.get("oauth_error");
    if (oauthErr) setError(oauthErr);
  }, [search]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Something went wrong.");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  const isSignUp = mode === "sign-up";
  return (
    <div className="w-full">
      <h1 className="text-3xl font-semibold tracking-tight">
        {isSignUp ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isSignUp ? "2 free dub minutes on signup." : "Sign in to your dashboard."}
      </p>

      <a href="/api/auth/google/start" className="mt-6 block">
        <Button type="button" variant="outline" size="lg" className="w-full">
          <GoogleIcon />
          Continue with Google
        </Button>
      </a>

      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <Input
          type="email"
          required
          autoComplete="email"
          placeholder="you@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          required
          minLength={8}
          autoComplete={isSignUp ? "new-password" : "current-password"}
          placeholder={isSignUp ? "At least 8 characters" : "Your password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button className="w-full" size="lg" type="submit" disabled={submitting}>
          {submitting ? "…" : isSignUp ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isSignUp ? (
          <>
            Already have an account?{" "}
            <Link href="/sign-in" className="text-primary hover:underline">Sign in</Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/sign-up" className="text-primary hover:underline">Create an account</Link>
          </>
        )}
      </p>

      {isSignUp && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          By signing up you agree to our DPDP-compliant privacy notice.
        </p>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.995 3.018v2.51h3.232c1.891-1.741 2.981-4.305 2.981-7.351z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.964-.895 6.619-2.422l-3.232-2.51c-.895.6-2.04.955-3.387.955-2.605 0-4.81-1.76-5.595-4.123H3.064v2.591A9.996 9.996 0 0 0 12 22z"
      />
      <path
        fill="#FBBC05"
        d="M6.405 13.9a6.013 6.013 0 0 1 0-3.8V7.51H3.064a10 10 0 0 0 0 8.98l3.341-2.59z"
      />
      <path
        fill="#EA4335"
        d="M12 5.977c1.469 0 2.786.504 3.823 1.495l2.868-2.868C16.96 2.99 14.696 2 12 2 8.118 2 4.762 4.234 3.064 7.509l3.341 2.591C7.19 7.737 9.395 5.977 12 5.977z"
      />
    </svg>
  );
}
