import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { TrendingDown, Target, Activity } from "lucide-react";

// Generate a deterministic price line
const generatePath = () => {
  const points: [number, number][] = [];
  let y = 50;
  for (let x = 0; x <= 100; x += 2) {
    y += (Math.sin(x / 6) + Math.cos(x / 10)) * 1.2 + (Math.random() - 0.5) * 1.5;
    points.push([x, y]);
  }
  // Force a crash near the end
  for (let i = 35; i < points.length; i++) {
    points[i][1] += (i - 35) * 0.9;
  }
  return points;
};

export const ReportAnimation = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-150px" });
  const [points] = useState(generatePath);
  const [drawn, setDrawn] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(() => setDrawn(1), 400);
    return () => clearTimeout(t);
  }, [inView]);

  const pathD = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const areaD = `${pathD} L100,100 L0,100 Z`;
  const supportY = 78;
  const aiSupportY = 92;

  return (
    <div ref={ref} className="glass rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-border bg-card/40">
        <div>
          <div className="font-mono text-[10px] text-muted-foreground tracking-widest">FULL REPORT · BTC/USDT</div>
          <div className="text-xl font-semibold mt-0.5">Volatility Event · #YJD-04219</div>
        </div>
        <div className="flex items-center gap-6 font-mono text-xs">
          <div>
            <div className="text-muted-foreground text-[10px] tracking-widest">PRICE</div>
            <div className="text-bear text-base">$65,891.20</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[10px] tracking-widest">24H Δ</div>
            <div className="text-bear text-base">-2.27%</div>
          </div>
          <div>
            <div className="text-muted-foreground text-[10px] tracking-widest">RISK</div>
            <div className="text-bear text-base flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5" /> HIGH
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-px bg-border/60">
        {/* Chart */}
        <div className="lg:col-span-2 bg-card/40 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono text-xs text-muted-foreground tracking-widest">PRICE · 4H</span>
            <div className="flex gap-1 font-mono text-[10px]">
              {["1H", "4H", "1D", "1W"].map((tf, i) => (
                <span
                  key={tf}
                  className={`px-2 py-1 rounded ${i === 1 ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
                >
                  {tf}
                </span>
              ))}
            </div>
          </div>

          <div className="relative aspect-[16/9] w-full">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
              {/* Grid lines */}
              {[20, 40, 60, 80].map((y) => (
                <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="hsl(var(--border))" strokeWidth="0.15" />
              ))}

              {/* Area fill */}
              <defs>
                <linearGradient id="bearGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--bear))" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="hsl(var(--bear))" stopOpacity="0" />
                </linearGradient>
              </defs>
              <motion.path
                d={areaD}
                fill="url(#bearGrad)"
                initial={{ opacity: 0 }}
                animate={{ opacity: drawn ? 1 : 0 }}
                transition={{ duration: 1.2, delay: 0.6 }}
              />

              {/* Price line */}
              <motion.path
                d={pathD}
                fill="none"
                stroke="hsl(var(--bear))"
                strokeWidth="0.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: drawn }}
                transition={{ duration: 1.6, ease: "easeInOut" }}
              />

              {/* Current support */}
              <motion.line
                x1="0" x2="100" y1={supportY} y2={supportY}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth="0.2"
                strokeDasharray="1 1"
                initial={{ opacity: 0 }}
                animate={{ opacity: drawn ? 1 : 0 }}
                transition={{ delay: 1.2 }}
              />

              {/* AI predicted support */}
              <motion.line
                x1="0" x2="100" y1={aiSupportY} y2={aiSupportY}
                stroke="hsl(var(--primary))"
                strokeWidth="0.3"
                strokeDasharray="2 1"
                initial={{ opacity: 0 }}
                animate={{ opacity: drawn ? 1 : 0 }}
                transition={{ delay: 1.5 }}
              />
            </svg>

            {/* Labels */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: drawn ? 1 : 0 }}
              transition={{ delay: 1.3 }}
              className="absolute right-0 font-mono text-[10px] text-muted-foreground bg-card/80 px-1.5 py-0.5 rounded"
              style={{ top: `${supportY}%`, transform: "translateY(-120%)" }}
            >
              SUPPORT · $65,200
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: drawn ? 1 : 0 }}
              transition={{ delay: 1.6 }}
              className="absolute right-0 font-mono text-[10px] text-primary bg-card/80 px-1.5 py-0.5 rounded"
              style={{ top: `${aiSupportY}%`, transform: "translateY(-120%)" }}
            >
              AI PREDICTED · $63,820
            </motion.div>
          </div>
        </div>

        {/* Side panel */}
        <div className="bg-card/40 p-6 space-y-5">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground tracking-widest mb-2">KEY LEVELS</div>
            <div className="space-y-2 font-mono text-sm">
              <Row label="Resistance" value="$68,400" tone="muted" />
              <Row label="Support" value="$65,200" tone="muted" />
              <Row label="AI Support" value="$63,820" tone="primary" icon={<Target className="h-3 w-3" />} />
            </div>
          </div>

          <div>
            <div className="font-mono text-[10px] text-muted-foreground tracking-widest mb-2">SIGNALS</div>
            <div className="space-y-2">
              <Pill label="Sell wall · Binance" tone="bear" />
              <Pill label="MT Gox wallet flow" tone="bear" />
              <Pill label="RSI 14 · 28 (oversold)" tone="muted" />
              <Pill label="Funding rate · -0.04%" tone="muted" />
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-2 font-mono text-[10px] text-primary tracking-widest mb-2">
              <Activity className="h-3 w-3" /> AI CONFIDENCE
            </div>
            <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-primary-glow"
                initial={{ width: 0 }}
                animate={{ width: drawn ? "94%" : 0 }}
                transition={{ duration: 1.2, delay: 1.8 }}
              />
            </div>
            <div className="font-mono text-xs mt-1.5 text-muted-foreground">94%</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Row = ({ label, value, tone, icon }: { label: string; value: string; tone: "muted" | "primary"; icon?: React.ReactNode }) => (
  <div className="flex items-center justify-between">
    <span className="text-muted-foreground flex items-center gap-1.5">{icon}{label}</span>
    <span className={tone === "primary" ? "text-primary" : "text-foreground"}>{value}</span>
  </div>
);

const Pill = ({ label, tone }: { label: string; tone: "bear" | "muted" }) => (
  <div
    className={`px-3 py-1.5 rounded-md font-mono text-xs border ${
      tone === "bear" ? "bg-bear/10 border-bear/30 text-bear" : "bg-secondary border-border text-muted-foreground"
    }`}
  >
    {label}
  </div>
);
