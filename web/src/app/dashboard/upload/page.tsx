import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { UploadForm } from "@/components/dashboard/UploadForm";

export default function UploadPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">New dub</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a Hindi or English video (≤10 min, ≤500 MB). We&apos;ll dub it into the languages you pick.
        </p>
        <div className="mt-8">
          <UploadForm />
        </div>
      </main>
      <Footer />
    </>
  );
}
