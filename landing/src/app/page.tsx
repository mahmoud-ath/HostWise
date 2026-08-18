import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Features } from "@/components/sections/Features";
import { Analytics } from "@/components/sections/Analytics";
import { Reports } from "@/components/sections/Reports";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Contact } from "@/components/sections/Contact";
import { Footer } from "@/components/Footer";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Analytics />
        <Reports />
        <HowItWorks />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
