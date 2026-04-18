import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface SectionProps {
  id?: string;
  index: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}

export const Section = ({ id, index, title, description, children }: SectionProps) => {
  return (
    <section id={id} className="relative py-32 md:py-40 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mb-16"
        >
          <div className="font-mono text-xs text-primary mb-4 tracking-widest">
            STEP / {index}
          </div>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tighter leading-[1.05]">
            {title}
          </h2>
          {description && (
            <p className="mt-5 text-lg text-muted-foreground max-w-xl">{description}</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          {children}
        </motion.div>
      </div>
    </section>
  );
};
