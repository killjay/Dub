export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="inline-block h-5 w-5 rounded bg-primary" aria-hidden />
          <span>DubKaroo · दुबकरूं</span>
          <span>·</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-5">
          <a href="/legal/privacy" className="hover:text-foreground">Privacy</a>
          <a href="/legal/terms" className="hover:text-foreground">Terms</a>
          <a href="mailto:hello@dubkaroo.com" className="hover:text-foreground">hello@dubkaroo.com</a>
        </div>
      </div>
    </footer>
  );
}
