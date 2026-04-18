import { motion } from "framer-motion";
import { Activity, ArrowRight } from "lucide-react";
import { Button } from "../ui/button";

interface FooterCTAProps {
  onEnterApp?: () => void;
}

export const FooterCTA = ({ onEnterApp }: FooterCTAProps) => {
  return (
    <section className="relative py-32 md:py-40 px-6 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute inset-0 bg-gradient-hero" />

      <div className="relative max-w-4xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.05]"
        >
          The markets never sleep. <br />
          <span className="text-gradient italic">Neither does</span>{" "}
          <span className="text-primary">YuJiDi</span>.
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-10 flex justify-center"
        >
          <Button
            size="lg"
            onClick={onEnterApp}
            className="font-mono text-sm h-14 px-8 bg-primary text-primary-foreground hover:bg-primary-glow glow-primary group"
          >
            START MONITORING NOW
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>
      </div>

      <div className="relative mt-32 max-w-7xl mx-auto pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground">YuJiDi</span>
          <span>· AI Crypto Risk Agent</span>
        </div>
        <div className="flex items-center gap-6">
          <span>v1.0.0</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-bull animate-pulse" />
            All systems operational
          </span>
        </div>
      </div>
    </section>
  );
};
