import { useState, useEffect } from "react";

const alerts = [
  "⚡ SOL spiked 5.2% in 5 minutes — whale accumulation detected",
  "🔺 Bull Flag pattern forming on ETH 15m chart",
  "🚨 BTC dropped 3.1% — liquidation cascade on Binance",
  "🧠 AI detected correlation: DOGE pump linked to social sentiment surge",
  "⚡ ARB volume anomaly — 340% above 7d average",
];

export function TerminalTyper() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = alerts[currentIndex];
    const speed = isDeleting ? 15 : 35;

    if (!isDeleting && displayText === current) {
      const timeout = setTimeout(() => setIsDeleting(true), 2000);
      return () => clearTimeout(timeout);
    }

    if (isDeleting && displayText === "") {
      setIsDeleting(false);
      setCurrentIndex((prev) => (prev + 1) % alerts.length);
      return;
    }

    const timeout = setTimeout(() => {
      setDisplayText(
        isDeleting
          ? current.substring(0, displayText.length - 1)
          : current.substring(0, displayText.length + 1)
      );
    }, speed);

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, currentIndex]);

  return (
    <div className="font-mono text-sm md:text-base bg-secondary/50 border border-border rounded-lg px-4 py-3 inline-flex items-center gap-2 max-w-2xl">
      <span className="text-primary animate-pulse">▶</span>
      <span className="text-muted-foreground">{displayText}</span>
      <span className="w-2 h-5 bg-primary animate-pulse inline-block" />
    </div>
  );
}