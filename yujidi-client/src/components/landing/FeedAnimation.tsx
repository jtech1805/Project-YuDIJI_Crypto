import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const tickers = [
  { sym: "BTC", base: 67421.5 },
  { sym: "ETH", base: 3481.2 },
  { sym: "SOL", base: 184.33 },
  { sym: "AVAX", base: 41.22 },
  { sym: "LINK", base: 17.84 },
];

const sampleJson = (sym: string, price: number, ts: number) =>
  `{"e":"trade","E":${ts},"s":"${sym}USDT","p":"${price.toFixed(2)}","q":"0.0421","T":${ts}}`;

export const FeedAnimation = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-150px" });
  const [lines, setLines] = useState<string[]>([]);
  const [prices, setPrices] = useState(tickers.map((t) => t.base));
  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  const [crashed, setCrashed] = useState(false);

  useEffect(() => {
    if (!inView) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      const tIdx = i % tickers.length;
      const drift = (Math.random() - 0.5) * tickers[tIdx].base * 0.0008;
      setPrices((prev) => {
        const next = [...prev];
        next[tIdx] = prev[tIdx] + drift;
        return next;
      });
      setLines((prev) => {
        const newLine = sampleJson(tickers[tIdx].sym, tickers[tIdx].base + drift, Date.now());
        return [...prev.slice(-9), newLine];
      });

      // Trigger crash after ~3s
      if (i === 28) {
        setPrices((prev) => {
          const next = [...prev];
          next[0] = prev[0] * 0.978;
          return next;
        });
        setFlashIdx(0);
        setCrashed(true);
        setLines((prev) => [
          ...prev.slice(-7),
          `{"e":"trade","s":"BTCUSDT","p":"65,891.20","q":"42.81","FLAG":"VOL_SPIKE"}`,
          `>>> ANOMALY DETECTED · BTC -2.27% · t+12ms`,
        ]);
        setTimeout(() => setFlashIdx(null), 1500);
      }
    }, 110);
    return () => clearInterval(interval);
  }, [inView]);

  return (
    <div ref={ref} className="grid md:grid-cols-2 gap-4 lg:gap-6">
      {/* Terminal */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card/60">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-bear/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/70" />
            <div className="h-2.5 w-2.5 rounded-full bg-bull/70" />
          </div>
          <span className="font-mono text-xs text-muted-foreground ml-2">wss://stream.yujidi.io/v1</span>
        </div>
        <div className="p-4 font-mono text-[11px] leading-relaxed h-80 overflow-hidden">
          {lines.length === 0 && (
            <div className="text-muted-foreground">connecting…</div>
          )}
          {lines.map((line, i) => {
            const isAlert = line.includes("ANOMALY") || line.includes("FLAG");
            return (
              <motion.div
                key={`${i}-${line.slice(0, 20)}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: i < lines.length - 6 ? 0.4 : 1, x: 0 }}
                className={isAlert ? "text-bear" : "text-muted-foreground"}
              >
                <span className="text-primary/60">{String(i).padStart(3, "0")}</span>{" "}
                <span className="break-all">{line}</span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Clean UI list */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card/60">
          <span className="font-mono text-xs text-muted-foreground tracking-widest">WATCHLIST</span>
          <span className="font-mono text-[10px] text-bull flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-bull animate-pulse" />
            STREAMING
          </span>
        </div>
        <div className="divide-y divide-border">
          {tickers.map((t, i) => {
            const flash = flashIdx === i;
            const isCrash = crashed && i === 0;
            return (
              <div
                key={t.sym}
                className={`flex items-center justify-between px-5 py-4 transition-colors ${
                  flash ? "bg-bear/20" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center font-mono text-[10px] font-bold">
                    {t.sym.slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-medium">{t.sym}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">USDT · spot</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-mono ${isCrash ? "text-bear" : "text-foreground"}`}>
                    ${prices[i].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className={`font-mono text-[11px] ${isCrash ? "text-bear" : "text-muted-foreground"}`}>
                    {isCrash ? "-2.27%" : ((prices[i] - t.base) / t.base * 100).toFixed(2) + "%"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
