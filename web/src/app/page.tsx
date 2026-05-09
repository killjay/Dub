import { Nav } from "@/components/site/Nav";
import { Hero } from "@/components/site/Hero";
import { LanguageDemo } from "@/components/site/LanguageDemo";
import { HowItWorks } from "@/components/site/HowItWorks";
import { Pricing } from "@/components/site/Pricing";
import { FAQ } from "@/components/site/FAQ";
import { Waitlist } from "@/components/site/Waitlist";
import { Footer } from "@/components/site/Footer";

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <LanguageDemo />
        <HowItWorks />
        <Pricing />
        <Waitlist />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
