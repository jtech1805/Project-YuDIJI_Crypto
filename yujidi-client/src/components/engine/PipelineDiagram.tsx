import { motion } from "framer-motion";
import { Radio, Cpu, Database, Brain, Send, Zap } from "lucide-react";

const nodes = [
    { icon: Radio, label: "Ingest", sub: "WebSocket L2 + Trades", detail: "Binance · OKX · Bybit", tone: "text-primary" },
    { icon: Cpu, label: "Process", sub: "CVD · Whale Sweeps", detail: "Node.js worker · 60s window", tone: "text-bull" },
    { icon: Database, label: "Vectorize", sub: "pgvector store", detail: "News + sentiment embeddings", tone: "text-primary" },
    { icon: Brain, label: "RAG Loop", sub: "Llama 3.0 + Retrieval", detail: "LangChain orchestration", tone: "text-bull" },
    { icon: Send, label: "Deliver", sub: "SSE / Socket.io", detail: "Sub-100ms to client", tone: "text-primary" },
];

export const PipelineDiagram = () => {
    return (
        <div className="relative">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {nodes.map((n, i) => {
                    const Icon = n.icon;
                    return (
                        <motion.div
                            key={n.label}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                            className="relative glass rounded-xl p-5 border border-white/10 bg-gradient-to-br from-card/80 to-card/40"
                        >
                            <div className="font-mono text-[10px] text-muted-foreground tracking-widest mb-3">
                                0{i + 1}
                            </div>
                            <Icon className={`h-6 w-6 ${n.tone} mb-3`} />
                            <div className="text-sm font-semibold">{n.label}</div>
                            <div className="text-xs text-muted-foreground mt-1">{n.sub}</div>
                            <div className="font-mono text-[10px] text-muted-foreground/70 mt-3 pt-3 border-t border-white/5">
                                {n.detail}
                            </div>

                            {i < nodes.length - 1 && (
                                <div className="hidden md:flex absolute top-1/2 -right-3 -translate-y-1/2 z-10 h-6 w-6 items-center justify-center rounded-full bg-background border border-white/10">
                                    <Zap className="h-3 w-3 text-primary" />
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* Animated data packet line */}
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-px -z-0 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        </div>
    );
};