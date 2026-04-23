import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Activity,
    ShieldAlert,
    Zap,
    TrendingDown,
    LineChart
} from 'lucide-react';
import { formatGlobalTime } from '../../lib/utils';

// Make sure this matches your updated Alert interface
interface Alert {
    _id: string;
    symbol: string;
    triggerPrice: number;
    dropPercentage: number;
    catalyst: string;
    threatLevel: string;
    support: string;
    resistance: string;
    summary: string;
    cvdAtTrigger: number;
    createdAt: string;
}

interface FullAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    alert: Alert | null;
}

export function FullAnalysisModal({ isOpen, onClose, alert }: FullAnalysisModalProps) {
    // Don't render the modal if it's closed or there is no data
    if (!alert) return null;

    // Reusable helper to style the Threat Level badge
    const getThreatLevelStyle = (level: string) => {
        if (level.includes('🔴')) return 'text-red-400 border-red-400/30 bg-red-400/10';
        if (level.includes('🟡')) return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10';
        if (level.includes('🟢')) return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10';
        return 'text-zinc-400 border-zinc-400/30 bg-zinc-400/10';
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
                        className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/[0.02]">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-white border border-white/20 shadow-inner">
                                    {alert.symbol.slice(0, 2)}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white tracking-tight">
                                        {alert.symbol} <span className="text-zinc-500 font-medium text-sm ml-2">Quantitative Report</span>
                                    </h2>
                                    <div className="flex items-center gap-3 mt-1 text-sm">
                                        <span className="text-zinc-400">
                                            {/* Triggered at {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} */}
                                            Triggered at  {formatGlobalTime(alert.createdAt)}

                                        </span>
                                        <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                        <span className="text-red-400 font-medium flex items-center gap-1">
                                            <TrendingDown className="w-3 h-3" />
                                            {alert.dropPercentage.toFixed(2)}% Drop
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <span className={`px-3 py-1.5 rounded-full border text-sm font-semibold shadow-sm ${getThreatLevelStyle(alert.threatLevel)}`}>
                                    {alert.threatLevel}
                                </span>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">

                            {/* Section 1: AI Executive Summary */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-violet-400" />
                                    AI Execution Playbook
                                </h3>
                                <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-5 space-y-4 shadow-[0_0_15px_rgba(139,92,246,0.05)_inset]">
                                    <div>
                                        <span className="text-violet-300 font-semibold text-sm mb-1 block">Primary Catalyst</span>
                                        <p className="text-zinc-200 text-sm leading-relaxed">{alert.catalyst}</p>
                                    </div>
                                    <div className="h-px w-full bg-violet-500/20" />
                                    <div>
                                        <span className="text-violet-300 font-semibold text-sm mb-1 block">Tactical Summary</span>
                                        <p className="text-zinc-300 text-sm leading-relaxed">{alert.summary}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Order Book Liquidity Walls */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4 text-blue-400" />
                                    Level 2 Liquidity Walls
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Support Wall */}
                                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50" />
                                        <span className="text-emerald-400/80 text-xs font-bold uppercase tracking-wider mb-2 block">Nearest Support</span>
                                        <div className="text-lg font-mono font-medium text-emerald-100">{alert.support}</div>
                                    </div>

                                    {/* Resistance Wall */}
                                    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-1 h-full bg-red-500/50" />
                                        <span className="text-red-400/80 text-xs font-bold uppercase tracking-wider mb-2 block">Nearest Resistance</span>
                                        <div className="text-lg font-mono font-medium text-red-100">{alert.resistance}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Momentum Metrics */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-amber-400" />
                                    Momentum Metrics
                                </h3>
                                <div className="bg-zinc-800/30 border border-white/5 rounded-xl p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-lg bg-zinc-800 border border-white/10">
                                            <LineChart className="w-5 h-5 text-zinc-400" />
                                        </div>
                                        <div>
                                            <div className="text-white font-medium text-sm">60-Second CVD (Volume Delta)</div>
                                            <div className="text-zinc-500 text-xs mt-0.5">Cumulative net buying/selling pressure at trigger</div>
                                        </div>
                                    </div>
                                    <div className={`text-xl font-mono font-bold px-4 py-2 rounded-lg border ${alert.cvdAtTrigger > 0
                                        ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                                        : alert.cvdAtTrigger < 0
                                            ? 'text-red-400 bg-red-400/10 border-red-400/20'
                                            : 'text-zinc-300 bg-zinc-800 border-zinc-600'
                                        }`}>
                                        {alert.cvdAtTrigger > 0 ? '+' : ''}{alert.cvdAtTrigger.toFixed(4)}
                                    </div>
                                </div>
                            </div>

                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}