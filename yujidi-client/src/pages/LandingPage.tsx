import { HeroSection } from "../components/HeroSection";
import { FeatureGrid } from "../components/FeatureGrid";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background selection:bg-primary/30">
      <HeroSection />
      {/* Sleek divider line replacing custom CSS */}
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <FeatureGrid />
    </div>
  );
}