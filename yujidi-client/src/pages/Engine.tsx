import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
    Activity,
    ArrowLeft,
    Brain,
    Database,
    Lock,
    Shield,
    Gauge,
    GitBranch,
    Server,
    KeyRound,
    ScrollText,
} from "lucide-react";
import { PipelineDiagram } from "../components/engine/PipelineDiagram";
import { StatCard } from "../components/engine/StatCard";
import { CodeBlock } from "../components/engine/CodeBlock";

const ragSnippet = `// RAG orchestration — grounding Llama 3.0 in verified data
const context = await vectorStore.similaritySearch(anomaly.signature, 5);
const prompt = buildPrompt({
  orderBookSnapshot: redis.get(\`book:\${symbol}\`),
  cvdWindow: aggregator.window(60),
  retrieved: context, // historical patterns + indexed news
});
const insight = await llama3.invoke(prompt); // descriptive, not prescriptive`;

const complianceSnippet = `// DPDP 2026 — consent + retention layer
await consent.assert(userId, "telemetry:thresholds");
await db.userTriggers.insert({
  userId,
  payload: aes256.encrypt(threshold, kms.dataKey),
  expiresAt: addDays(new Date(), 30), // strict purge policy
});`;

const Engine = () => {
    return (
        <main className="min-h-screen bg-background text-foreground overflow-x-hidden">
            {/* Nav */}
            <nav className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-white/5">
                <div className="max-w-7xl mx-auto flex items-center justify-between px-6 md:px-12 py-4">
                    <Link to="/" className="flex items-center gap-2 font-mono">
                        <Activity className="h-5 w-5 text-primary" />
                        <span className="font-semibold tracking-tight">YuJiDi</span>
                        <span className="text-xs text-muted-foreground hidden sm:inline">/ Engine</span>
                    </Link>
                    <Link
                        to="/"
                        className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    >
                        <ArrowLeft className="h-3 w-3" /> BACK
                    </Link>
                </div>
            </nav>

            {/* Hero */}
            <section className="relative px-6 md:px-12 pt-24 pb-20 overflow-hidden">
                <div className="absolute inset-0 grid-bg opacity-50" />
                <div className="absolute inset-0 bg-gradient-hero" />
                <div className="relative max-w-5xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass mb-6 font-mono text-xs text-muted-foreground"
                    >
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                        ARCHITECTURE · v0.4.1
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.1 }}
                        className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.02]"
                    >
                        The YuJiDi Engine: <br className="hidden md:block" />
                        <span className="text-gradient italic">Scalable semantic analysis.</span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl"
                    >
                        Deconstructing a real-time RAG pipeline for high-throughput VDA data —
                        from raw order book ingestion to grounded LLM insight in under 100ms.
                    </motion.p>
                </div>
            </section>

            {/* 1. System Flow */}
            <section className="px-6 md:px-12 py-20 border-t border-white/5">
                <div className="max-w-7xl mx-auto">
                    <div className="font-mono text-xs text-primary mb-3 tracking-widest">SECTION / 01</div>
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tighter leading-[1.1] mb-4">
                        Data telemetry & high-level flow.
                    </h2>
                    <p className="text-muted-foreground max-w-2xl mb-12">
                        Persistent WebSocket connections to global liquidity hubs process ~5,000 events
                        per second. A custom aggregator computes CVD metrics in a 60-second sliding window.
                    </p>
                    <PipelineDiagram />
                </div>
            </section>

            {/* 2. RAG Pipeline */}
            <section className="px-6 md:px-12 py-20 border-t border-white/5 bg-card/20">
                <div className="max-w-7xl mx-auto">
                    <div className="font-mono text-xs text-bull mb-3 tracking-widest">SECTION / 02</div>
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tighter leading-[1.1] mb-4">
                        Semantic retrieval-augmented generation.
                    </h2>
                    <p className="text-muted-foreground max-w-2xl mb-12">
                        Unlike traditional "Black Box" models, YuJiDi uses RAG to ground Llama 3.0 in
                        reality. When an anomaly is detected, the system queries a vector database for
                        similar historical patterns — providing descriptive analysis rather than a
                        speculative guess.
                    </p>

                    <div className="grid md:grid-cols-2 gap-6 items-start">
                        <div className="space-y-5">
                            <div className="flex items-start gap-4 glass rounded-xl p-5 border border-white/10">
                                <Brain className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                                <div>
                                    <div className="text-sm font-semibold">Hallucination guardrails</div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        The LLM only analyzes data retrieved from the verified order book and
                                        historical price action stored in our vector store.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 glass rounded-xl p-5 border border-white/10">
                                <Database className="h-5 w-5 text-bull mt-0.5 shrink-0" />
                                <div>
                                    <div className="text-sm font-semibold">pgvector + LangChain</div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        News and social sentiment are embedded and indexed for sub-50ms similarity
                                        retrieval. Orchestration handled via LangChain.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 glass rounded-xl p-5 border border-white/10">
                                <GitBranch className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                                <div>
                                    <div className="text-sm font-semibold">Deterministic prompt graph</div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Every prompt is composed from verifiable retrieval — no free-form
                                        speculation enters the inference path.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <CodeBlock title="rag-orchestrator.ts" code={ragSnippet} />
                    </div>
                </div>
            </section>

            {/* 3. Performance */}
            <section className="px-6 md:px-12 py-20 border-t border-white/5">
                <div className="max-w-7xl mx-auto">
                    <div className="font-mono text-xs text-primary mb-3 tracking-widest">SECTION / 03</div>
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tighter leading-[1.1] mb-4">
                        Low-latency performance.
                    </h2>
                    <p className="text-muted-foreground max-w-2xl mb-12">
                        Every layer is optimized for throughput. Hot market data lives in Redis; the
                        stream itself is durably buffered through Kafka.
                    </p>

                    <div className="grid md:grid-cols-3 gap-5">
                        <StatCard
                            label="EVENT → DB"
                            value="<100"
                            unit="ms"
                            tone="primary"
                            description="End-to-end ingestion from exchange WebSocket event to durable persistence."
                        />
                        <StatCard
                            label="THROUGHPUT"
                            value="5k"
                            unit="events/s"
                            tone="bull"
                            description="Sustained event rate across multi-exchange WebSocket connections."
                        />
                        <StatCard
                            label="RETRIEVAL"
                            value="48"
                            unit="ms p95"
                            tone="primary"
                            description="Vector similarity search latency over the historical pattern corpus."
                        />
                    </div>

                    <div className="grid md:grid-cols-3 gap-5 mt-5">
                        <div className="glass rounded-xl p-5 border border-white/10 flex items-start gap-3">
                            <Server className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                            <div>
                                <div className="text-sm font-semibold">Redis hot cache</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Order book snapshots and CVD windows kept resident in memory.
                                </p>
                            </div>
                        </div>
                        <div className="glass rounded-xl p-5 border border-white/10 flex items-start gap-3">
                            <Gauge className="h-5 w-5 text-bull mt-0.5 shrink-0" />
                            <div>
                                <div className="text-sm font-semibold">Kafka backbone</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    High-throughput event streaming with replay-safe consumer groups.
                                </p>
                            </div>
                        </div>
                        <div className="glass rounded-xl p-5 border border-white/10 flex items-start gap-3">
                            <Activity className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                            <div>
                                <div className="text-sm font-semibold">SSE delivery</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Server-Sent Events push insights to the frontend without polling overhead.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 4. Compliance */}
            <section className="px-6 md:px-12 py-20 border-t border-white/5 bg-card/20">
                <div className="max-w-7xl mx-auto">
                    <div className="font-mono text-xs text-bear mb-3 tracking-widest">SECTION / 04</div>
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tighter leading-[1.1] mb-4">
                        2026 compliance stack.
                    </h2>
                    <p className="text-muted-foreground max-w-2xl mb-12">
                        Regulatory engineering treated as a first-class concern — DPDP 2026 readiness
                        and SEBI "white box" transparency are baked into the platform architecture.
                    </p>

                    <div className="grid md:grid-cols-2 gap-6 items-start">
                        <CodeBlock title="consent-layer.ts" code={complianceSnippet} />
                        <div className="space-y-5">
                            <div className="flex items-start gap-4 glass rounded-xl p-5 border border-white/10">
                                <Lock className="h-5 w-5 text-bull mt-0.5 shrink-0" />
                                <div>
                                    <div className="text-sm font-semibold">DPDP 2026 readiness</div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Consent management layer · all user-defined thresholds encrypted at rest
                                        (AES-256) · strict 30-day retention and purge policy.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 glass rounded-xl p-5 border border-white/10">
                                <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                                <div>
                                    <div className="text-sm font-semibold">SEBI white-box logic</div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        The Logic Monitor is purely user-driven. The system never generates its
                                        own buy/sell triggers — staying below the SEBI 10 OPS threshold for
                                        regular API utilities.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 glass rounded-xl p-5 border border-white/10">
                                <KeyRound className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                                <div>
                                    <div className="text-sm font-semibold">Identity & audit</div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        OAuth 2.0 ensures authenticated audit trails. User-defined triggers are
                                        stored as cryptographic hashes to protect intellectual property.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 glass rounded-xl p-5 border border-white/10">
                                <ScrollText className="h-5 w-5 text-bear mt-0.5 shrink-0" />
                                <div>
                                    <div className="text-sm font-semibold">Information utility, not advisor</div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Built-in rate limiters ensure the platform operates as a technical research
                                        tool — adhering to the 2026 SEBI Framework for market data utilities.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="px-6 md:px-12 py-12 border-t border-white/5">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <p className="font-mono text-[11px] text-muted-foreground max-w-2xl leading-relaxed">
                        YuJiDi is a technical demonstration of LLM-based RAG architectures for VDA market data.
                        Not investment advice. Market data sourced via public exchange APIs. AI insights are
                        experimental and subject to model hallucinations.
                    </p>
                    <Link
                        to="/"
                        className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        ← Back to landing
                    </Link>
                </div>
            </footer>
        </main>
    );
};

export default Engine;