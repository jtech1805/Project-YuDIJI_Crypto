import type { ReactNode } from 'react';
import { motion } from "framer-motion";

interface StatCardProps {
    label: string;
    value: string;
    unit?: string;
    description?: ReactNode;
    tone?: "primary" | "bull" | "bear";
}

export const StatCard = ({ label, value, unit, description, tone = "primary" }: StatCardProps) => {
    const toneClass =
        tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : "text-primary";
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="glass rounded-xl p-6 border border-white/10"
        >
            <div className="font-mono text-[10px] text-muted-foreground tracking-widest mb-2">
                {label}
            </div>
            <div className="flex items-baseline gap-1">
                <span className={`text-4xl md:text-5xl font-bold tracking-tighter ${toneClass}`}>
                    {value}
                </span>
                {unit && <span className="font-mono text-sm text-muted-foreground">{unit}</span>}
            </div>
            {description && (
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{description}</p>
            )}
        </motion.div>
    );
};