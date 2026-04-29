import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, MousePointer2, Sparkles } from "lucide-react";

export const SetupAnimation = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-150px" });
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const timers = [
      setTimeout(() => setStep(1), 600),   // open dropdown
      setTimeout(() => setStep(2), 1400),  // pick BTC
      setTimeout(() => setStep(3), 2200),  // slide threshold
      setTimeout(() => setStep(4), 3000),  // toggle AI
      setTimeout(() => setStep(5), 3800),  // press start
    ];
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  const sliderPct = step >= 3 ? 30 : 50; // -2% threshold
  const aiOn = step >= 4;
  const started = step >= 5;

  return (
    <div ref={ref} className="relative">
      <div
        className={`relative max-w-xl mx-auto glass rounded-2xl p-8 transition-shadow duration-500 ${started ? "glow-primary" : ""
          }`}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground tracking-widest">CONFIG / 01</div>
            <h3 className="text-xl font-semibold mt-1">Logic Monitor</h3>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${started ? "bg-bull animate-pulse" : "bg-muted-foreground/40"}`} />
            {started ? "ACTIVE" : "IDLE"}
          </div>
        </div>

        {/* Asset selector */}
        <label className="font-mono text-[10px] text-muted-foreground tracking-widest">ASSET</label>
        <div className="relative mt-2">
          <button className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-secondary border border-border text-left">
            <span className="font-mono">{step >= 2 ? "BTC · Bitcoin" : "Select asset…"}</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${step === 1 ? "rotate-180" : ""}`} />
          </button>
          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute z-10 mt-2 w-full rounded-lg bg-popover border border-border overflow-hidden font-mono text-sm"
            >
              {["BTC · Bitcoin", "ETH · Ethereum", "SOL · Solana"].map((s, i) => (
                <div
                  key={s}
                  className={`px-4 py-2.5 ${i === 0 ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                >
                  {s}
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Drop threshold slider */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <label className="font-mono text-[10px] text-muted-foreground tracking-widest">TRIGGER SENSITIVITY</label>
            <span className={`font-mono text-sm ${step >= 3 ? "text-bear" : "text-muted-foreground"}`}>
              {step >= 3 ? "-2.00%" : "-5.00%"}
            </span>
          </div>
          <div className="relative mt-3 h-1.5 rounded-full bg-secondary">
            <motion.div
              className="absolute left-0 top-0 h-full rounded-full bg-bear/70"
              animate={{ width: `${sliderPct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
            <motion.div
              className="absolute -top-1.5 h-4 w-4 rounded-full bg-foreground border-2 border-bear shadow-lg"
              animate={{ left: `calc(${sliderPct}% - 8px)` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* AI toggle */}
        <div className="mt-6 flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border">
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-md flex items-center justify-center ${aiOn ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-medium">Enable Real-time Webhooks</div>
              <div className="font-mono text-[10px] text-muted-foreground">RAG-driven payload · adds ~80ms</div>
            </div>
          </div>
          <div className={`relative w-11 h-6 rounded-full transition-colors ${aiOn ? "bg-primary" : "bg-secondary border border-border"}`}>
            <motion.div
              className="absolute top-0.5 h-5 w-5 rounded-full bg-foreground"
              animate={{ left: aiOn ? "22px" : "2px" }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            />
          </div>
        </div>

        {/* Start button */}
        <motion.button
          className={`mt-6 w-full py-3 rounded-lg font-mono text-sm tracking-wider transition-all ${started
            ? "bg-primary text-primary-foreground glow-primary"
            : "bg-secondary text-foreground border border-border"
            }`}
          animate={started ? { scale: [1, 0.97, 1] } : {}}
          transition={{ duration: 0.3 }}
        >
          {started ? "PIPELINE ACTIVE ●" : "START PIPELINE"}
        </motion.button>

        {/* Simulated cursor — positioned via % so it tracks the card on any width.
            Targets (approx within card):
              step 0: idle bottom-right
              step 1-2: asset dropdown (top area)
              step 3: slider thumb at 30%
              step 4: AI toggle (right side)
              step 5: Start button (center bottom) */}
        <motion.div
          className="absolute pointer-events-none z-20 text-foreground"
          style={{ top: 0, left: 0 }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: inView ? 1 : 0,
            left:
              step === 0 ? "85%" :
                step === 1 || step === 2 ? "30%" :
                  step === 3 ? "33%" :
                    step === 4 ? "82%" :
                      "50%",
            top:
              step === 0 ? "92%" :
                step === 1 || step === 2 ? "32%" :
                  step === 3 ? "53%" :
                    step === 4 ? "70%" :
                      "92%",
          }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        >
          <MousePointer2 className="h-5 w-5 fill-foreground -translate-x-1 -translate-y-1" />
        </motion.div>
      </div>
    </div>
  );
};
