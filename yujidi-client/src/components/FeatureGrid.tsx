import { Zap, Brain, TrendingUp } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Millisecond Tripwires",
    description: "Deploy custom price and volume triggers that fire in under 50ms. Never miss a market-moving event again.",
    accent: "primary",
    glowClass: "shadow-[0_0_15px_rgba(168,85,247,0.15)]",
  },
  {
    icon: Brain,
    title: "AI Root Cause Analysis",
    description: "Our AI doesn't just alert you — it explains why. On-chain flows, order book imbalances, and social catalysts decoded instantly.",
    accent: "ai-accent",
    glowClass: "shadow-[0_0_15px_rgba(168,85,247,0.3)]",
  },
  {
    icon: TrendingUp,
    title: "Price Action Pattern Detection",
    description: "Automatically detect bull flags, head & shoulders, and 47 other patterns across every timeframe simultaneously.",
    accent: "primary",
    glowClass: "shadow-[0_0_15px_rgba(168,85,247,0.15)]",
  },
];

export function FeatureGrid() {
  return (
    <section className="py-24 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-foreground">
          Intelligence at <span className="bg-gradient-to-r from-bullish to-primary bg-clip-text text-transparent">Machine Speed</span>
        </h2>
        <p className="text-muted-foreground text-center mb-16 max-w-xl mx-auto">
          Three layers of detection working together to give you an unfair advantage.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={`glass-card p-8 ${feature.glowClass} hover:-translate-y-1 transition-all duration-300 group`}
            >
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-6 bg-primary/10`}>
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-foreground">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}