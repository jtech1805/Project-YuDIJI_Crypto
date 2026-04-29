import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";

const fullText =
  "Analyzing order book depth... Sell-side pressure detected on Binance correlated with MT Gox wallet movement via semantic retrieval. Estimated 12,400 BTC inflow to exchange in last 4 minutes. Pattern confidence: 94%.";

export const AlertAnimation = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-150px" });
  const [typed, setTyped] = useState("");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(() => setShow(true), 400);
    return () => clearTimeout(t);
  }, [inView]);

  useEffect(() => {
    if (!show) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setTyped(fullText.slice(0, i));
      if (i >= fullText.length) clearInterval(interval);
    }, 22);
    return () => clearInterval(interval);
  }, [show]);

  return (
    <div ref={ref} className="relative max-w-2xl mx-auto">
      {/* Ambient red glow */}
      <div className="absolute -inset-8 bg-bear/10 blur-3xl rounded-full" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={show ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative glass rounded-2xl overflow-hidden border-bear/30"
        style={{ borderColor: "hsl(var(--bear) / 0.3)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bear/5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-bear/15 flex items-center justify-center animate-pulse-glow">
              <AlertTriangle className="h-4.5 w-4.5 text-bear" />
            </div>
            <div>
              <div className="font-mono text-[10px] text-muted-foreground tracking-widest">INTELLIGENCE FEED</div>
              <div className="font-semibold">Detected Pattern · Volatility Anomaly</div>
            </div>
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">
            T+12<span className="text-muted-foreground/60">ms</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-muted-foreground tracking-widest">SYMBOL</span>
              <span className="font-mono font-semibold">BTC/USDT</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-muted-foreground tracking-widest">FLOW</span>
              <span
                className="px-2.5 py-1 rounded-md bg-bear/15 text-bear font-mono text-xs font-semibold tracking-wider animate-pulse-glow"
                style={{ boxShadow: "0 0 20px hsl(var(--bear) / 0.4)" }}
              >
                SELL-SIDE PRESSURE
              </span>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-muted-foreground tracking-widest">Δ</span>
              <span className="font-mono text-bear">-2.27%</span>
            </div>
          </div>

          {/* AI block */}
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono text-[10px] tracking-widest text-primary">RAG · DETECTED PATTERN</span>
            </div>
            <p className="font-mono text-sm leading-relaxed text-foreground/90 min-h-[6rem]">
              {typed}
              {typed.length < fullText.length && (
                <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 align-middle animate-pulse" />
              )}
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors">
              Dismiss
            </button>
            <button className="font-mono text-xs px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary-glow transition-colors">
              VIEW FULL REPORT →
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
