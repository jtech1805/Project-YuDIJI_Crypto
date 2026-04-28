// import { motion } from "framer-motion";
// import { Activity, ArrowRight } from "lucide-react";
// import { Button } from "../ui/button";

// interface FooterCTAProps {
//   onEnterApp?: () => void;
// }

// export const FooterCTA = ({ onEnterApp }: FooterCTAProps) => {
//   return (
//     <section className="relative py-32 md:py-40 px-6 overflow-hidden">
//       <div className="absolute inset-0 grid-bg opacity-40" />
//       <div className="absolute inset-0 bg-gradient-hero" />

//       <div className="relative max-w-4xl mx-auto text-center">
//         <motion.h2
//           initial={{ opacity: 0, y: 20 }}
//           whileInView={{ opacity: 1, y: 0 }}
//           viewport={{ once: true }}
//           transition={{ duration: 0.7 }}
//           className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.05]"
//         >
//           The markets never sleep. <br />
//           <span className="text-gradient italic">Neither does</span>{" "}
//           <span className="text-primary">YuJiDi</span>.
//         </motion.h2>

//         <motion.div
//           initial={{ opacity: 0, y: 20 }}
//           whileInView={{ opacity: 1, y: 0 }}
//           viewport={{ once: true }}
//           transition={{ duration: 0.6, delay: 0.2 }}
//           className="mt-10 flex justify-center"
//         >
//           <Button
//             size="lg"
//             onClick={onEnterApp}
//             className="font-mono text-sm h-14 px-8 bg-primary text-primary-foreground hover:bg-primary-glow glow-primary group"
//           >
//             START MONITORING NOW
//             <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
//           </Button>
//         </motion.div>
//       </div>

//       <div className="relative mt-32 max-w-7xl mx-auto pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs text-muted-foreground">
//         <div className="flex items-center gap-2">
//           <Activity className="h-4 w-4 text-primary" />
//           <span className="font-semibold text-foreground">YuJiDi</span>
//           <span>· AI Crypto Risk Agent</span>
//         </div>
//         <div className="flex items-center gap-6">
//           <span>v1.0.0</span>
//           <span className="flex items-center gap-1.5">
//             <span className="h-1.5 w-1.5 rounded-full bg-bull animate-pulse" />
//             All systems operational
//           </span>
//         </div>
//       </div>
//     </section>
//   );
// };
import { motion } from "framer-motion";
import { Activity, ArrowRight } from "lucide-react";
import { Button } from "../../components/ui/button";

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
          <span className="text-gradient italic">Neither does the</span>{" "}
          <span className="text-primary">data pipeline</span>.
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
          <span>· LLM-based RAG Research Tool</span>
        </div>
        <div className="flex items-center gap-6">
          <span>v1.0.0</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-bull animate-pulse" />
            All systems operational
          </span>
        </div>
      </div>

      <div className="relative mt-8 max-w-4xl mx-auto px-2">
        <div className="rounded-lg border border-border bg-card/40 p-5 font-mono text-[14px] leading-relaxed text-muted-foreground">
          <span className="text-foreground font-semibold tracking-widest text-[20px]">DISCLAIMER · </span>
          Project YuJiDi is a non-commercial technical research project demonstrating RAG (Retrieval-Augmented Generation) architectures. This platform is NOT registered with SEBI. We do not provide investment advice, trading signals, or financial research. All data is for algorithmic testing and educational purposes only        </div>
      </div>
    </section>
  );
};
