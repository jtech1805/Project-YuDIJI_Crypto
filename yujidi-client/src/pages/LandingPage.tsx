// import { HeroSection } from "../components/HeroSection";
// import { FeatureGrid } from "../components/FeatureGrid";

// export default function LandingPage() {
//   return (
//     <div className="min-h-screen bg-background selection:bg-primary/30">
//       <HeroSection />
//       {/* Sleek divider line replacing custom CSS */}
//       <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
//       <FeatureGrid />
//     </div>
//   );
// }

import { Hero } from "../components/landing/Hero";
import { Section } from "../components/landing/Section";
import { SetupAnimation } from "../components/landing/SetupAnimation";
import { FeedAnimation } from "../components/landing/FeedAnimation";
import { AlertAnimation } from "../components/landing/AlertAnimation";
import { ReportAnimation } from "../components/landing/ReportAnimation";
import { FooterCTA } from "../components/landing/FooterCTA";
import { AuthCard } from "../components/landing/AuthCard";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { useState } from "react";

const LandingPage = () => {
  const [authOpen, setAuthOpen] = useState(false);
  const handleEnterApp = () => setAuthOpen(true);

  return (
    <main className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Hero onEnterApp={handleEnterApp} />

      <Section
        id="calibrate"
        index="01"
        // title={<>Calibrate <span className="text-gradient italic">your risk.</span></>}
        // description="Pick the asset, set your drop threshold, and turn on the AI co-pilot. Three clicks to a live monitor."
        title={<>Customize <span className="text-gradient italic">logic thresholds.</span></>}
        description="Select the asset, tune signal sensitivity, and enable real-time webhooks. Three clicks to a live data pipeline."

      >
        <SetupAnimation />
      </Section>

      <Section
        index="02"
        title={<>Millisecond <span className="text-primary">market ingestion.</span></>}
        description="Direct WebSocket feeds from every major exchange, normalized and parsed in under 15ms."
      >
        <FeedAnimation />
      </Section>

      <Section
        index="03"
        // title={<>Catch the anomaly <span className="text-bear italic">before</span> the market reacts.</>}
        // description="The instant volatility breaches your threshold, an AI-authored alert lands in your feed — not a price tick, an explanation."
        title={<>Identify anomalies using <span className="text-bear italic">semantic retrieval.</span></>}
        description="The instant volatility breaches your threshold, an LLM-authored technical summary lands in your feed — a detected pattern, not a recommendation."
      >
        <AlertAnimation />
      </Section>

      <Section
        index="04"
        title={<>Total <span className="text-gradient italic">clarity.</span></>}
        description="One click expands the alert into a full report: price action, key levels, and the AI's predicted next support zone."
      >
        <ReportAnimation />
      </Section>

      <FooterCTA onEnterApp={handleEnterApp} />

      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="bg-transparent border-0 p-0 shadow-none max-w-md">
          <DialogTitle className="sr-only">Sign in to YuJiDi</DialogTitle>
          <DialogDescription className="sr-only">
            Authenticate to access the AI Crypto Risk Agent dashboard.
          </DialogDescription>
          <AuthCard onSuccess={() => setAuthOpen(false)} />
        </DialogContent>
      </Dialog>
    </main>
  );
};
export default LandingPage;
