import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";

export default function Terms() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-5 py-12 prose prose-zinc">
        <h1>Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-IN")}.</p>
        <h2>Your content</h2>
        <p>
          You confirm you own — or are licensed for — the source video and any music in it.
          You retain all rights to outputs we generate.
        </p>
        <h2>Acceptable use</h2>
        <ul>
          <li>No deepfakes or impersonation of third parties.</li>
          <li>No content that violates Indian law (IT Act 2000, BNS).</li>
          <li>No defamatory or hate content.</li>
        </ul>
        <h2>Voice cloning (v2+)</h2>
        <p>Mandatory consent recording before training. Disabled on plan cancellation.</p>
        <h2>Refunds</h2>
        <p>
          If a dub fails our QA bar (lip-sync drift, audio glitch) we re-run on us. If it still fails,
          we credit the minutes back.
        </p>
        <h2>DMCA / IT Act takedown</h2>
        <p>
          24-hour response window. Email <a href="mailto:dmca@dubkaroo.com">dmca@dubkaroo.com</a> with
          the URL and proof of ownership.
        </p>
      </main>
      <Footer />
    </>
  );
}
