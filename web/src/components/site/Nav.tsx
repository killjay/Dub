import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth";
import { SignOutButton } from "@/components/auth/SignOutButton";

export async function Nav() {
  const user = await getSessionUser();
  return (
    <header className="sticky top-0 z-40 glass border-b border-border/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-block h-7 w-7 rounded-md bg-primary" aria-hidden />
          <span className="text-lg">DubKaroo</span>
          <span className="hidden text-sm text-muted-foreground sm:inline">· दुबकरूं</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <Link href="/#languages" className="hover:text-foreground">Languages</Link>
          <Link href="/#how" className="hover:text-foreground">How it works</Link>
          <Link href="/#pricing" className="hover:text-foreground">Pricing</Link>
          <Link href="/#faq" className="hover:text-foreground">FAQ</Link>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">Dashboard</Button>
              </Link>
              <span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/sign-in" className="hidden sm:block">
                <Button variant="ghost" size="sm">Sign in</Button>
              </Link>
              <Link href="/sign-up">
                <Button size="sm">Sign up</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
