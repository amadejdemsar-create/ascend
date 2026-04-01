import { LandingNav } from "./_landing/LandingNav";
import { HeroSection } from "./_landing/HeroSection";
import { HierarchySection } from "./_landing/HierarchySection";
import { ViewsSection } from "./_landing/ViewsSection";
import { FeaturesSection } from "./_landing/FeaturesSection";
import { CtaSection } from "./_landing/CtaSection";
import { Footer } from "./_landing/Footer";
import "./_landing/landing.css";

export default function LandingPage() {
  return (
    <div
      className="landing-page landing-noise relative min-h-dvh bg-[#0F0F14] text-white dark"
      style={{ colorScheme: "dark" }}
    >
      {/* Floating gradient orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="landing-orb landing-orb-1" />
        <div className="landing-orb landing-orb-2" />
        <div className="landing-orb landing-orb-3" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <LandingNav />
        <HeroSection />
        <div className="landing-divider mx-auto max-w-4xl" />
        <HierarchySection />
        <div className="landing-divider mx-auto max-w-4xl" />
        <ViewsSection />
        <div className="landing-divider mx-auto max-w-4xl" />
        <FeaturesSection />
        <div className="landing-divider mx-auto max-w-4xl" />
        <CtaSection />
        <Footer />
      </div>
    </div>
  );
}
