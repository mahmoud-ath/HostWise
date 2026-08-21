import { useEffect } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Gallery from "./components/sections/Gallery";
import Features from "./components/sections/Features";
import Download from "./components/sections/Download";
import Philosophy from "./components/sections/Philosophy";
import Faq from "./components/sections/Faq";
import Footer from "./components/Footer";
import Guide from "./pages/Guide";
import Feedback from "./pages/Feedback";
import NotFound from "./pages/NotFound";
import { DownloadGateProvider } from "./lib/leadGate";
import { useHashRoute } from "./lib/router";

function Home() {
  return (
    <main>
      <Hero />
      <Philosophy />
      <Gallery />
      <Features />
      <Download />
      <Faq />
    </main>
  );
}

export default function App() {
  const { route, guideId } = useHashRoute();

  useEffect(() => {
    if (route !== "home" && route !== "notfound") window.scrollTo(0, 0);
  }, [route]);

  // The 404 is a standalone full-screen page: no navbar, no footer.
  if (route === "notfound") return <NotFound />;

  return (
    <DownloadGateProvider>
      <div className="min-h-screen overflow-x-hidden bg-white">
        <Navbar />
        {route === "home" && <Home />}
        {route === "docs" && <Guide guideId={guideId} />}
        {route === "feedback" && <Feedback />}
        <Footer />
      </div>
    </DownloadGateProvider>
  );
}
