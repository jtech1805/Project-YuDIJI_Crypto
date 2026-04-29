import { motion } from "framer-motion";
import { ArrowRight, Activity } from "lucide-react";
import { Button } from "../ui/button";
import { Link } from "react-router-dom";

interface HeroProps {
  onEnterApp?: () => void;
}

export const Hero = ({ onEnterApp }: HeroProps) => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated grid background */}
      <div className="absolute inset-0 grid-bg animate-grid-pan" />
      {/* Radial glow */}
      <div className="absolute inset-0 bg-gradient-hero" />

      {/* Faint candlestick pattern */}
      <div className="absolute inset-0 flex items-end justify-around opacity-[0.07] pointer-events-none px-8">
        {Array.from({ length: 40 }).map((_, i) => {
          const h = 30 + ((i * 37) % 200);
          const isBull = i % 3 !== 0;
          return (
            <div key={i} className="flex flex-col items-center" style={{ height: `${h}px` }}>
              <div className="w-px flex-1 bg-foreground/40" />
              <div
                className={`w-1.5 ${isBull ? "bg-bull" : "bg-bear"}`}
                style={{ height: `${h * 0.6}px` }}
              />
              <div className="w-px h-2 bg-foreground/40" />
            </div>
          );
        })}
      </div>

      {/* Top nav
      <nav className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-6 md:px-12 py-6">
        <div className="flex items-center gap-2 font-mono">
          <Activity className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-tight">YuJiDi</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">AI Crypto Pattern Monitor</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onEnterApp} className="font-mono text-xs">
          SIGN IN
        </Button>
      </nav> */}
      {/* Top nav */}
      <nav className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-6 md:px-12 py-6">
        <div className="flex items-center gap-2 font-mono">
          <Activity className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-tight">YuJiDi</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">/ AI Crypto Risk Agent</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/engine"
            className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
          >
            ENGINE
          </Link>
          <Button variant="ghost" size="sm" onClick={onEnterApp} className="font-mono text-xs">
            SIGN IN
          </Button>
        </div>
      </nav>
      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass mb-8 font-mono text-xs text-muted-foreground"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-bull animate-pulse" />
          {/* LIVE · v1.0 · Real-time anomaly detection */}
          BETA · For Research & Performance Benchmarking Only
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.95]"
        >
          Don't just watch <br className="hidden md:block" />
          the market.{" "}
          {/* <span className="text-gradient italic">Understand</span>{" "}
          <span className="relative inline-block">
            the
            <span className="text-bear"> crash</span>
            <span className="absolute -inset-1 bg-bear/20 blur-2xl -z-10" />
          </span>
          . */}
          <span className="text-gradient italic">Analyze</span>{" "}
          <span className="relative inline-block">
            market
            <span className="text-bear"> volatility</span>
            <span className="absolute -inset-1 bg-bear/20 blur-2xl -z-10" />
          </span>{" "}
          in real-time.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
        >
          {/* AI-driven volatility scanning and root-cause analysis delivered in milliseconds. */}
          LLM-based RAG pipelines for semantic anomaly retrieval and technical pattern analysis — delivered in milliseconds.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Button
            size="lg"
            onClick={onEnterApp}
            className="font-mono text-sm h-12 px-6 bg-primary text-primary-foreground hover:bg-primary-glow glow-primary group"
          >
            ENTER APP
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
          <a
            href="#calibrate"
            className="font-mono text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-3"
          >
            See how it works ↓
          </a>
        </motion.div>

        {/* Live ticker strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.7 }}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-px bg-border/50 glass rounded-lg overflow-hidden font-mono text-xs"
        >
          {[
            { sym: "BTC", price: "67,421.50", chg: "+1.24%", up: true },
            { sym: "ETH", price: "3,481.20", chg: "-0.42%", up: false },
            { sym: "SOL", price: "184.33", chg: "+3.81%", up: true },
            { sym: "AVG LATENCY", price: "12ms", chg: "OK", up: true },
          ].map((t) => (
            <div key={t.sym} className="bg-card/60 px-4 py-3 text-left">
              <div className="text-muted-foreground text-[10px] tracking-widest">{t.sym}</div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-foreground">{t.price}</span>
                <span className={t.up ? "text-bull" : "text-bear"}>{t.chg}</span>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
