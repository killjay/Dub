import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";

export default function Privacy() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-5 py-12 prose prose-zinc">
        <h1>Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">
          Last updated: {new Date().toLocaleDateString("en-IN")}. Generate the production version
          via <a href="https://dpdpact.co.in/" className="text-primary">dpdpact.co.in</a> before launch.
        </p>
        <h2>What we collect</h2>
        <ul>
          <li>Email + channel URL (waitlist, account)</li>
          <li>Uploaded videos and dubbed outputs (R2, encrypted at rest)</li>
          <li>Payment metadata via Razorpay (we never see card details)</li>
        </ul>
        <h2>How we use it</h2>
        <ul>
          <li>Run the dub pipeline (ASR/translation/TTS/lip-sync)</li>
          <li>Send job notifications via email + WhatsApp</li>
          <li>Aggregate, anonymized analytics (PostHog)</li>
        </ul>
        <h2>Your rights under DPDP Act 2023</h2>
        <p>
          Right to access, correct, erase, and withdraw consent. Email{" "}
          <a href="mailto:privacy@dubkaroo.com">privacy@dubkaroo.com</a>.
        </p>
        <h2>Data retention</h2>
        <p>Source uploads deleted 30 days after job completion. Outputs retained for the lifetime of your account.</p>
        <h2>Breach notification</h2>
        <p>72-hour notification SOP per DPDP §8.</p>
      </main>
      <Footer />
    </>
  );
}
