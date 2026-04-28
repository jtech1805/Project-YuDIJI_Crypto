import { useEffect, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Sparkles, TrendingDown,
  Search, Wifi, AlertTriangle, BarChart3, Settings, Share2, TrendingUp, Zap, ArrowDownRight, Activity, CheckCircle2
} from 'lucide-react';
import { apiClient } from '../api/client';
import { useWebSocket } from '../context/WebSocketContext';
import { AddMonitorModal } from '../components/dashboard/AddMonitorModal';
import { FullAnalysisModal } from '../components/dashboard/FullAnalysisModal';
import { formatGlobalTime } from '../lib/utils';
// ─── Types ───────────────────────────────────────────────────────────────────
type TriggerType = "spike" | "drop" | "Pattern";

interface Monitor {
  _id: string;
  symbol: string;
  thresholdPercentage: number;
  trigger: TriggerType;
  timeWindowMinutes: number
}
const triggerMeta: Record<TriggerType, { icon: typeof Zap; label: string; color: string; bg: string; ring: string }> = {
  spike: {
    icon: Zap,
    label: "Spike",
    color: "text-bullish",
    bg: "bg-bullish/10",
    ring: "ring-bullish/20",
  },
  drop: {
    icon: ArrowDownRight,
    label: "Drop",
    color: "text-bearish",
    bg: "bg-bearish/10",
    ring: "ring-bearish/20",
  },
  Pattern: {
    icon: Activity,
    label: "Pattern",
    color: "text-ai-accent",
    bg: "bg-ai-accent/10",
    ring: "ring-ai-accent/20",
  },
};
// ─── Mini Sparkline ───────────────────────────────────────────────────────────

const MOCK_SPARKLINES: Record<string, number[]> = {
  BTCUSDT: [40, 42, 41, 45, 48, 47, 50, 52],
  ETCUSDT: [50, 48, 52, 49, 47, 45, 44, 43],
  SOLUSDT: [30, 28, 32, 35, 33, 38, 42, 45],
  ARB: [10, 12, 11, 15, 18, 20, 25, 28],
  DEFAULT: [20, 21, 20, 22, 21, 23, 22, 24],
};

function MiniSparkline({ symbol, positive }: { symbol: string; positive: boolean }) {
  const data = MOCK_SPARKLINES[symbol] ?? MOCK_SPARKLINES.DEFAULT;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 24, w = 60;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(' ');
  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <polyline
        fill="none"
        stroke={positive ? '#22c55e' : '#ef4444'}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}

// ─── Sidebar Monitor Item ─────────────────────────────────────────────────────

function MonitorItem({
  monitor,
  price,
  change,
  onDelete,
}: {
  monitor: Monitor;
  price: number | undefined;
  change: number;
  onDelete: (id: string, symbol: string) => void;
}) {
  // Simulate a subtle change % for display (real data would come from WS)
  // const changePercent = null; // set to real value if available
  const positive = change ? change >= 0 : false;
  const trigger = monitor?.trigger ? monitor?.trigger : 'spike'
  const threshold = monitor.thresholdPercentage
  const symbol = monitor.symbol
  // const positive = change ? change >= 0 : 0;
  const meta = triggerMeta[trigger];
  const TriggerIcon = meta?.icon;
  // Determine if the move toward the trigger direction has breached threshold
  const movement = trigger === "drop" ? -change : change; // Drop watches negative moves
  const breached =
    trigger === "Pattern" ? Math.abs(change) >= threshold : movement >= threshold;
  const progress = Math.min(100, (Math.abs(movement) / threshold) * 100);
  const distance = +(threshold - movement).toFixed(2);
  return (
    <div className="flex flex-col gap-2 px-3 py-3 hover:bg-secondary/40 rounded-lg transition-colors cursor-pointer group border border-transparent hover:border-border">
      {/* Top row: identity + price */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0">
          {symbol.slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{symbol}</span>
            <span className="text-xs font-mono text-muted-foreground">{price != null
              ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
              : '---'}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <MiniSparkline symbol={symbol} positive={positive} />
            <span className={`text-xs font-mono flex items-center gap-0.5 ${positive ? "text-bullish" : "text-bearish"}`}>
              {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {positive ? "+" : ""}{change}%
            </span>
          </div>
        </div>
      </div>

      {/* Trigger row */}
      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md ring-1 ${meta.bg} ${meta.ring}`}>
          <TriggerIcon className={`w-3 h-3 ${meta.color}`} />
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${meta.color}`}>
            {meta.label}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">
            ≥ {threshold}%
          </span>
        </div>
        <div className="flex items-center gap-1">
          {breached ? (
            <span className="flex items-center gap-1 text-[10px] font-mono text-bullish">
              <AlertTriangle className="w-3 h-3" />
              TRIGGERED
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
              <CheckCircle2 className="w-3 h-3" />
              {distance > 0 ? `${distance}% away` : "armed"}
            </span>
          )}
        </div>
      </div>

      {/* Threshold progress bar */}
      <div className="h-1 w-full bg-secondary/60 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${breached ? meta.color.replace("text-", "bg-") : "bg-muted-foreground/40"
            }`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className='flex items-end justify-end'><button
        onClick={(e) => { e.stopPropagation(); onDelete(monitor._id, monitor.symbol); }}
        className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-500 transition-all ml-2"
        title="Remove monitor"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button></div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function DashboardSidebar({
  monitors,
  livePrices,
  livePriceschange,
  onAddMonitor,
  onDelete,
}: {
  monitors: Monitor[];
  livePrices: Record<string, number>;
  livePriceschange: Record<string, number>;
  onAddMonitor: () => void;
  onDelete: (id: string, symbol: string) => void;
}) {
  return (
    <aside className="w-72 border-r border-white/[0.06] bg-zinc-950/80 flex flex-col h-screen sticky top-0 shrink-0">
      {/* Brand + Add */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded bg-violet-500/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <span className="font-semibold text-white text-sm tracking-wide">Crypto Monitor</span>
        </div>
        <button
          onClick={onAddMonitor}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 hover:text-violet-200 text-sm font-medium transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          Add Monitor
        </button>
      </div>

      {/* Monitors List */}
      <div className="p-3 flex-1 overflow-y-auto">
        <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest px-4 mb-3 block">
          {/* Active Tripwires */}
          Logic Triggers
        </span>

        {monitors.length === 0 ? (
          <div className="mx-3 mt-2 p-4 border border-dashed border-white/[0.08] rounded-xl text-center text-zinc-600 text-xs leading-relaxed">
            No monitors active.
            <br />Deploy one to start.
          </div>
        ) : (
          <div className="space-y-1 mt-1">
            {monitors.map((m) => (
              <MonitorItem
                key={m._id}
                monitor={m}
                price={livePrices[m.symbol]}
                change={livePriceschange[m.symbol]}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function DashboardHeader() {
  return (
    <header className="h-14 border-b border-white/[0.06] bg-zinc-950/60 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            placeholder="Search assets or AI reports..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/[0.08] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500/50 h-9 transition-colors"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="text-emerald-400 font-medium">Live Feed</span>
        </div>
        <div className="w-px h-5 bg-white/[0.08]" />
        {/* <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-300 text-xs font-bold cursor-pointer hover:bg-violet-500/30 transition-colors">
          AI
        </div>
        <button
          onClick={onLogout}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-4 h-4" />
        </button> */}
      </div>
    </header>
  );
}

// ─── Alert Card ───────────────────────────────────────────────────────────────

// interface Alert {
//   _id: string;
//   symbol: string;
//   dropPercentage: number;
//   sentiment: string;
//   aiRootCause: string;
//   createdAt: string;
// }
// src/types.ts
export interface Alert {
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


// function AlertCard({ alert }: { alert: Alert }) {
//   const sentiment = sentimentConfig[alert.sentiment] ?? {
//     label: alert.sentiment,
//     classes: 'text-zinc-400 border-zinc-400/30 bg-zinc-400/10',
//   };

//   return (
//     <motion.div
//       initial={{ opacity: 0, y: -16 }}
//       animate={{ opacity: 1, y: 0 }}
//       exit={{ opacity: 0, scale: 0.97 }}
//       transition={{ duration: 0.25 }}
//       className="bg-zinc-900/60 border border-white/[0.06] hover:border-white/[0.10] rounded-xl p-5 transition-all duration-300"
//     >
//       {/* Card Header */}
//       <div className="flex items-center justify-between mb-4">
//         <div className="flex items-center gap-3">
//           <div className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-sm font-bold text-white border border-white/10">
//             {alert.symbol.slice(0, 2)}
//           </div>
//           <div>
//             <div className="flex items-center gap-2">
//               <span className="font-semibold text-white">{alert.symbol}</span>
//               <span className="text-xs text-zinc-500">{new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
//             </div>
//             <div className="flex items-center gap-1.5 mt-0.5">
//               <TrendingDown className="w-3.5 h-3.5 text-red-400" />
//               <span className="text-sm font-semibold text-red-400">
//                 Dropped {alert.dropPercentage}%
//               </span>
//             </div>
//           </div>
//         </div>
//         <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${sentiment.classes}`}>
//           {sentiment.label}
//         </span>
//       </div>

//       {/* AI Analysis Box */}
//       <div className="bg-violet-500/[0.04] border border-violet-500/20 rounded-lg p-4 mb-4">
//         <div className="flex items-center gap-2 mb-2">
//           <Sparkles className="w-3.5 h-3.5 text-violet-400" />
//           <span className="text-[10px] font-semibold text-violet-400 tracking-widest uppercase">
//             AI Root Cause Analysis
//           </span>
//         </div>
//         <p className="text-sm text-zinc-300 leading-relaxed">{alert.aiRootCause}</p>
//       </div>

//       {/* Actions */}
//       <div className="flex items-center gap-2">
//         <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-300 hover:text-violet-200 text-xs font-medium transition-all duration-200">
//           <BarChart3 className="w-3.5 h-3.5" />
//           Full Analysis
//         </button>
//         <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/[0.08] text-zinc-400 hover:text-zinc-300 text-xs font-medium transition-all duration-200">
//           <Settings className="w-3.5 h-3.5" />
//           Adjust Tripwire
//         </button>
//         <button className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/[0.08] text-zinc-500 hover:text-zinc-300 transition-all duration-200">
//           <Share2 className="w-3.5 h-3.5" />
//         </button>
//       </div>
//     </motion.div>
//   );
// }

// ─── Alert Feed ───────────────────────────────────────────────────────────────


interface AlertCardProps {
  alert: Alert;
  onOpenAnalysis: (alert: Alert) => void;
}

export function AlertCard({ alert, onOpenAnalysis }: AlertCardProps) {
  // Dynamically style the badge based on the AI's emoji prefix
  const getThreatLevelStyle = (level: string) => {
    if (level.includes('🔴')) return 'text-red-400 border-red-400/30 bg-red-400/10';
    if (level.includes('🟡')) return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10';
    if (level.includes('🟢')) return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10';
    return 'text-zinc-400 border-zinc-400/30 bg-zinc-400/10';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25 }}
      className="bg-zinc-900/60 border border-white/[0.06] hover:border-white/[0.10] rounded-xl p-5 transition-all duration-300"
    >
      {/* Card Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-sm font-bold text-white border border-white/10">
            {alert.symbol.slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{alert.symbol}</span>
              <span className="text-xs text-zinc-500">
                {/* {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} */}
                {formatGlobalTime(alert.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              <span className="text-sm font-semibold text-red-400">
                Dropped {alert.dropPercentage.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* New Threat Level Badge */}
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${getThreatLevelStyle(alert.threatLevel)}`}>
          {alert.threatLevel}
        </span>
      </div>

      {/* AI Analysis Box (Now uses Catalyst) */}
      <div className="bg-violet-500/[0.04] border border-violet-500/20 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-[10px] font-semibold text-violet-400 tracking-widest uppercase">
            AI Catalyst
          </span>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">{alert.catalyst}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onOpenAnalysis(alert)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-300 hover:text-violet-200 text-xs font-medium transition-all duration-200"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Full Analysis
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/[0.08] text-zinc-400 hover:text-zinc-300 text-xs font-medium transition-all duration-200">
          <Settings className="w-3.5 h-3.5" />
          {/* Adjust Tripwire */}
          Edit Threshold
        </button>
        <button className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/[0.08] text-zinc-500 hover:text-zinc-300 transition-all duration-200">
          <Share2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
function AlertFeed({ alerts }: { alerts: Alert[] }) {
  // 1. Add state to track which alert is currently selected for the modal
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  return (
    <div className="space-y-4 p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          {/* Intelligence Feed */}
          Activity Stream
        </h2>
        <span className="text-xs text-zinc-500 font-mono flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-violet-400 inline" />
          {alerts.length} active alert{alerts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* <AnimatePresence>
        {alerts.length === 0 ? (
          <div className="text-zinc-600 text-sm p-6 border border-dashed border-white/[0.06] rounded-xl text-center">
            Awaiting market anomalies...
          </div>
        ) : (
          alerts.map((alert) => <AlertCard key={alert._id} alert={alert} />)
        )}
      </AnimatePresence> */}
      <AnimatePresence>
        {alerts.length === 0 ? (
          <div className="text-zinc-600 text-sm p-6 border border-dashed border-white/[0.06] rounded-xl text-center">
            Awaiting market anomalies...
          </div>
        ) : (
          alerts.map((alert) => (
            // 2. Pass the state-setting function down to the card
            <AlertCard
              key={alert._id}
              alert={alert}
              onOpenAnalysis={(clickedAlert) => setSelectedAlert(clickedAlert)}
            />
          ))
        )}
      </AnimatePresence>

      {/* 3. Render the Modal (it handles its own AnimatePresence and visibility based on selectedAlert) */}
      <FullAnalysisModal
        isOpen={selectedAlert !== null}
        onClose={() => setSelectedAlert(null)}
        alert={selectedAlert}
      />
    </div>
  );
}

export function Dashboard() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [showModal, setShowModal] = useState(false);
  const { livePrices, alerts, setInitialAlerts, updateSubscriptions, livePriceschange } = useWebSocket();
  // const navigate = useNavigate();
  const fetchData = async () => {
    try {
      const [monitorsRes, alertsRes] = await Promise.all([
        apiClient.get('/monitors'),
        apiClient.get('/alerts'),
      ]);

      const monitorsArray = Array.isArray(monitorsRes.data)
        ? monitorsRes.data
        : (monitorsRes.data?.data ?? []);
      const alertsArray = Array.isArray(alertsRes.data)
        ? alertsRes.data
        : (alertsRes.data?.data ?? []);

      setMonitors(monitorsArray);
      setInitialAlerts(alertsArray);

      const symbols = monitorsArray.map((m: Monitor) => m.symbol);
      if (symbols.length > 0) updateSubscriptions(symbols, []);
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const deleteMonitor = async (id: string) => {
    try {
      await apiClient.delete(`/monitors/${id}`);
      setMonitors((prev) => prev.filter((m) => m._id !== id));
    } catch (error) {
      console.error('Failed to delete monitor');
    }
  };

  return (
    <div className="flex min-h-screen bg-[#080808]">
      <DashboardSidebar
        monitors={monitors}
        livePrices={livePrices}
        livePriceschange={livePriceschange}
        onAddMonitor={() => setShowModal(true)}
        onDelete={deleteMonitor}
      />

      <div className="flex-1 flex flex-col min-h-screen">
        <DashboardHeader />
        <main className="flex-1 overflow-y-auto">
          <AlertFeed alerts={alerts} />
        </main>
      </div>

      {/* <AddMonitorModal open={showModal} onClose={() => setShowModal(false)} /> */}
      <AddMonitorModal open={showModal} onClose={() => setShowModal(false)} onSuccess={() => fetchData()} />
    </div>
  );
}