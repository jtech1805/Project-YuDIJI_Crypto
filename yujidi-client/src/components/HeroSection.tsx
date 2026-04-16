import { TerminalTyper } from "../components/TerminalTyper";
import { AuthCard } from "./AuthCard";
import { Shield } from "lucide-react";

export function HeroSection() {
  return (
    <section className="min-h-screen flex items-center px-6 py-20">
      <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8 animate-fade-in">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4 text-primary" />
            <span>Project YuJiDi — AI Crypto Risk Intelligence</span>
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight text-foreground">
            Turn Market Noise into{" "}
            <span className="bg-gradient-to-r from-bullish to-primary bg-clip-text text-transparent">
              Business Intelligence.
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg">
            Deploy AI-powered tripwires across every crypto asset. Get root cause analysis,
            not just alerts.
          </p>
          <TerminalTyper />
        </div>
        <div className="flex justify-center lg:justify-end animate-slide-up">
          <AuthCard />
        </div>
      </div>
    </section>
  );
}