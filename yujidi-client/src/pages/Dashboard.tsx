// import { useEffect, useMemo } from 'react'
// import { AlertFeed } from '../components/alerts/AlertFeed'
// import { MonitorCard } from '../components/monitor/MonitorCard'
// import { useWebSocket, type Alert } from '../context/WebSocketContext'

// const monitorData = [
//   { symbol: 'BTC/USDT', price: '$67,210.22', sparkline: [42, 45, 44, 46, 50, 48, 52] },
//   { symbol: 'ETH/USDT', price: '$3,120.73', sparkline: [23, 25, 24, 26, 27, 30, 29] },
//   { symbol: 'SOL/USDT', price: '$152.09', sparkline: [18, 16, 19, 21, 20, 23, 25] },
//   { symbol: 'XRP/USDT', price: '$0.63', sparkline: [12, 13, 12, 14, 15, 14, 16] },
// ]

// const dummyAlerts: Alert[] = [
//   {
//     id: 'a1',
//     symbol: 'BTC/USDT',
//     message: 'Whale transfer pattern detected with unusual exchange inflow velocity.',
//     severity: 'high',
//     createdAt: 'Now',
//   },
//   {
//     id: 'a2',
//     symbol: 'ETH/USDT',
//     message: 'Social sentiment divergence indicates potential short-lived volatility spike.',
//     severity: 'medium',
//     createdAt: '2m ago',
//   },
//   {
//     id: 'a3',
//     symbol: 'SOL/USDT',
//     message: 'On-chain activity rising while derivatives funding remains neutral.',
//     severity: 'low',
//     createdAt: '6m ago',
//   },
// ]

// export function Dashboard() {
//   const { alerts, subscribe } = useWebSocket()

//   useEffect(() => {
//     subscribe(monitorData.map((item) => item.symbol))
//   }, [subscribe])

//   const combinedAlerts = useMemo(
//     () => (alerts.length > 0 ? alerts : dummyAlerts),
//     [alerts],
//   )

//   return (
//     <div className="space-y-8">
//       <section>
//         <h2 className="mb-4 text-xl font-semibold text-purple-300">
//           Active Monitors
//         </h2>
//         <div className="flex gap-4 overflow-x-auto pb-2">
//           {monitorData.map((monitor) => (
//             <MonitorCard key={monitor.symbol} {...monitor} />
//           ))}
//         </div>
//       </section>

//       <AlertFeed alerts={combinedAlerts} />
//     </div>
//   )
// }

//Original dashbaord code
// import React, { useEffect, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { motion, AnimatePresence } from 'framer-motion';
// import { Plus, Trash2, Sparkles, TrendingDown, Clock, LogOut } from 'lucide-react';
// import { apiClient } from '../api/client';
// import { useWebSocket } from '../context/WebSocketContext';
// import { useAuth } from '../context/AuthContext';

// interface Monitor {
//   _id: string;
//   symbol: string;
//   thresholdPercentage: number;
// }

// export function Dashboard() {
//   const [monitors, setMonitors] = useState<Monitor[]>([]);
//   const { livePrices, alerts, setInitialAlerts, updateSubscriptions } = useWebSocket();
//   const { logout } = useAuth();
//   const navigate = useNavigate();

//   // // Initial Data Load
//   // useEffect(() => {
//   //   const fetchData = async () => {
//   //     try {
//   //       const [monitorsRes, alertsRes] = await Promise.all([
//   //         apiClient.get('/monitors'),
//   //         apiClient.get('/alerts')
//   //       ]);
        
//   //       setMonitors(monitorsRes.data);
//   //       setInitialAlerts(alertsRes.data);

//   //       // Tell WS to subscribe to these symbols
//   //       const symbols = monitorsRes.data.map((m: Monitor) => m.symbol);
//   //       if (symbols.length > 0) updateSubscriptions(symbols, []);
        
//   //     } catch (error) {
//   //       console.error("Failed to fetch dashboard data");
//   //     }
//   //   };
//   //   fetchData();
//   // }, []);
//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         const [monitorsRes, alertsRes] = await Promise.all([
//           apiClient.get('/monitors'),
//           apiClient.get('/alerts')
//         ]);
        
//         // BULLETPROOFING: Force React to find the array, no matter how the backend wraps it.
//         const monitorsArray = Array.isArray(monitorsRes.data) ? monitorsRes.data : (monitorsRes.data?.data || []);
//         const alertsArray = Array.isArray(alertsRes.data) ? alertsRes.data : (alertsRes.data?.data || []);

//         setMonitors(monitorsArray);
//         setInitialAlerts(alertsArray);

//         const symbols = monitorsArray.map((m: Monitor) => m.symbol);
//         if (symbols.length > 0) updateSubscriptions(symbols, []);
        
//       } catch (error) {
//         console.error("Failed to fetch dashboard data", error);
//       }
//     };
//     fetchData();
//   }, []);
//   const deleteMonitor = async (id: string, symbol: string) => {
//     try {
//       await apiClient.delete(`/monitors/${id}`);
//       setMonitors(prev => prev.filter(m => m._id !== id));
//       // Optional: Logic to unsubscribe from WS if no other monitors use this symbol
//     } catch (error) {
//       console.error("Failed to delete monitor");
//     }
//   };

//   return (
//     <div className="min-h-screen bg-[#0A0A0A] p-4 md:p-8">
//       {/* Header */}
//       <div className="flex justify-between items-center mb-8 max-w-6xl mx-auto">
//         <h1 className="text-2xl font-bold text-white">Dashboard</h1>
//         <div className="flex gap-4">
//           <button onClick={() => navigate('/setup')} className="flex items-center px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors border border-white/10">
//             <Plus className="w-4 h-4 mr-2" /> Add Monitor
//           </button>
//           <button onClick={logout} className="p-2 text-zinc-500 hover:text-red-500 transition-colors">
//             <LogOut className="w-5 h-5" />
//           </button>
//         </div>
//       </div>

//       <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
//         {/* Left Column: Active Monitors */}
//         <div className="lg:col-span-1 space-y-4">
//           <h2 className="text-lg font-semibold text-zinc-400 mb-4 px-1">Active Tripwires</h2>
//           {monitors.length === 0 && (
//             <div className="p-6 border border-dashed border-white/10 rounded-xl text-center text-zinc-500">
//               No monitors active. Deploy one to start.
//             </div>
//           )}
//           {monitors.map(monitor => (
//             <div key={monitor._id} className="bg-zinc-900/50 border border-white/5 rounded-xl p-5 relative group flex flex-col">
//               <div className="flex justify-between items-start mb-2">
//                 <span className="text-lg font-bold text-white">{monitor.symbol}</span>
//                 <button 
//                   onClick={() => deleteMonitor(monitor._id, monitor.symbol)}
//                   className="text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
//                 >
//                   <Trash2 className="w-4 h-4" />
//                 </button>
//               </div>
//               <div className="text-2xl font-mono text-white mb-1">
//                 ${livePrices[monitor.symbol]?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '---'}
//               </div>
//               <div className="text-sm text-zinc-500">Alert if drops {monitor.thresholdPercentage}%</div>
//             </div>
//           ))}
//         </div>

//         {/* Right Column: AI Alert Feed */}
//         <div className="lg:col-span-2">
//           <h2 className="text-lg font-semibold text-zinc-400 mb-4 px-1 flex items-center">
//             <Sparkles className="w-4 h-4 mr-2 text-purple-500" /> Intelligence Feed
//           </h2>
          
//           <div className="space-y-4">
//             <AnimatePresence>
//               {alerts.length === 0 && (
//                 <div className="text-zinc-500 text-sm p-4">Awaiting market anomalies...</div>
//               )}
//               {alerts.map((alert) => (
//                 <motion.div
//                   key={alert._id}
//                   initial={{ opacity: 0, y: -20 }}
//                   animate={{ opacity: 1, y: 0 }}
//                   exit={{ opacity: 0, scale: 0.95 }}
//                   className="bg-zinc-900/80 border border-white/5 rounded-xl p-5"
//                 >
//                   <div className="flex justify-between items-start mb-4">
//                     <div className="flex items-center">
//                       <div className="w-2 h-2 rounded-full bg-red-500 mr-3 animate-pulse" />
//                       <span className="font-bold text-white text-lg">{alert.symbol}</span>
//                       <span className="ml-3 px-2 py-1 bg-red-500/10 text-red-500 text-xs font-bold rounded flex items-center">
//                         <TrendingDown className="w-3 h-3 mr-1" /> {alert.dropPercentage}%
//                       </span>
//                     </div>
//                     <div className="text-xs text-zinc-500 flex items-center">
//                       <Clock className="w-3 h-3 mr-1" />
//                       {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
//                     </div>
//                   </div>
                  
//                   {/* AI Output Box */}
//                   <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
//                     <div className="flex items-center mb-2">
//                       <Sparkles className="w-3 h-3 text-purple-400 mr-2" />
//                       <span className="text-xs font-semibold text-purple-400 tracking-wider uppercase">AI Root Cause Analysis</span>
//                       <span className={`ml-auto text-xs px-2 py-0.5 rounded border ${
//                         alert.sentiment === 'Panic' ? 'text-red-400 border-red-400/30 bg-red-400/10' : 
//                         alert.sentiment === 'Bearish' ? 'text-orange-400 border-orange-400/30 bg-orange-400/10' : 
//                         'text-zinc-400 border-zinc-400/30 bg-zinc-400/10'
//                       }`}>
//                         {alert.sentiment}
//                       </span>
//                     </div>
//                     <p className="text-sm text-zinc-300 leading-relaxed">
//                       {alert.aiRootCause}
//                     </p>
//                   </div>
//                 </motion.div>
//               ))}
//             </AnimatePresence>
//           </div>
//         </div>

//       </div>
//     </div>
//   );
// }
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Sparkles, TrendingDown, TrendingUp, Clock,
  LogOut, Search, Wifi, AlertTriangle, BarChart3, Settings, Share2, X, Rocket
} from 'lucide-react';
import { apiClient } from '../api/client';
import { useWebSocket } from '../context/WebSocketContext';
import { useAuth } from '../context/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Monitor {
  _id: string;
  symbol: string;
  thresholdPercentage: number;
}

// ─── Mini Sparkline ───────────────────────────────────────────────────────────

const MOCK_SPARKLINES: Record<string, number[]> = {
  BTC: [40, 42, 41, 45, 48, 47, 50, 52],
  ETH: [50, 48, 52, 49, 47, 45, 44, 43],
  SOL: [30, 28, 32, 35, 33, 38, 42, 45],
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
  onDelete,
}: {
  monitor: Monitor;
  price: number | undefined;
  onDelete: (id: string, symbol: string) => void;
}) {
  // Simulate a subtle change % for display (real data would come from WS)
  const changePercent = null; // set to real value if available
  const positive = true;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-lg transition-colors cursor-pointer group">
      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
        {monitor.symbol.slice(0, 2)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white">{monitor.symbol}</span>
          <span className="text-xs font-mono text-zinc-400">
            {price != null
              ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
              : '---'}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <MiniSparkline symbol={monitor.symbol} positive={positive} />
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(monitor._id, monitor.symbol); }}
            className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-500 transition-all ml-2"
            title="Remove monitor"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function DashboardSidebar({
  monitors,
  livePrices,
  onAddMonitor,
  onDelete,
}: {
  monitors: Monitor[];
  livePrices: Record<string, number>;
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
          <span className="font-semibold text-white text-sm tracking-wide">CryptoWatch</span>
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
          Active Tripwires
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

function DashboardHeader({ onLogout }: { onLogout: () => void }) {
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
          <span className="text-emerald-400 font-medium">WebSocket Connected</span>
        </div>
        <div className="w-px h-5 bg-white/[0.08]" />
        <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-300 text-xs font-bold cursor-pointer hover:bg-violet-500/30 transition-colors">
          AI
        </div>
        <button
          onClick={onLogout}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

// ─── Alert Card ───────────────────────────────────────────────────────────────

interface Alert {
  _id: string;
  symbol: string;
  dropPercentage: number;
  sentiment: string;
  aiRootCause: string;
  createdAt: string;
}

const sentimentConfig: Record<string, { label: string; classes: string }> = {
  Panic:   { label: 'Panic',   classes: 'text-red-400 border-red-400/30 bg-red-400/10' },
  Bearish: { label: 'Bearish', classes: 'text-orange-400 border-orange-400/30 bg-orange-400/10' },
};

function AlertCard({ alert }: { alert: Alert }) {
  const sentiment = sentimentConfig[alert.sentiment] ?? {
    label: alert.sentiment,
    classes: 'text-zinc-400 border-zinc-400/30 bg-zinc-400/10',
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
              <span className="text-xs text-zinc-500">{new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              <span className="text-sm font-semibold text-red-400">
                Dropped {alert.dropPercentage}% 
              </span>
            </div>
          </div>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${sentiment.classes}`}>
          {sentiment.label}
        </span>
      </div>

      {/* AI Analysis Box */}
      <div className="bg-violet-500/[0.04] border border-violet-500/20 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-[10px] font-semibold text-violet-400 tracking-widest uppercase">
            AI Root Cause Analysis
          </span>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">{alert.aiRootCause}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-300 hover:text-violet-200 text-xs font-medium transition-all duration-200">
          <BarChart3 className="w-3.5 h-3.5" />
          Full Analysis
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/[0.08] text-zinc-400 hover:text-zinc-300 text-xs font-medium transition-all duration-200">
          <Settings className="w-3.5 h-3.5" />
          Adjust Tripwire
        </button>
        <button className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/[0.08] text-zinc-500 hover:text-zinc-300 transition-all duration-200">
          <Share2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Alert Feed ───────────────────────────────────────────────────────────────

function AlertFeed({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="space-y-4 p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          Intelligence Feed
        </h2>
        <span className="text-xs text-zinc-500 font-mono flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-violet-400 inline" />
          {alerts.length} active alert{alerts.length !== 1 ? 's' : ''}
        </span>
      </div>

      <AnimatePresence>
        {alerts.length === 0 ? (
          <div className="text-zinc-600 text-sm p-6 border border-dashed border-white/[0.06] rounded-xl text-center">
            Awaiting market anomalies...
          </div>
        ) : (
          alerts.map((alert) => <AlertCard key={alert._id} alert={alert} />)
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Add Monitor Modal ────────────────────────────────────────────────────────

const ASSET_LIST = [
  'BTC — Bitcoin', 'ETH — Ethereum', 'SOL — Solana',
  'ARB — Arbitrum', 'DOGE — Dogecoin', 'AVAX — Avalanche',
  'MATIC — Polygon', 'LINK — Chainlink',
];
const TRIGGER_TYPES = ['Price Spike', 'Price Drop', 'Pattern Detection'] as const;

function AddMonitorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selectedTrigger, setSelectedTrigger] = useState<string>('Price Spike');
  const [searchQuery, setSearchQuery] = useState('');

  if (!open) return null;

  const filtered = ASSET_LIST.filter((a) =>
    a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg mx-4 bg-zinc-900 border border-white/[0.08] rounded-2xl p-8 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-white mb-1">Deploy New Tripwire</h2>
        <p className="text-sm text-zinc-500 mb-6">Configure your AI-powered monitoring agent.</p>

        <div className="space-y-5">
          {/* Asset Search */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 font-medium uppercase tracking-wider block">Select Asset</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/[0.08] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
            {searchQuery && filtered.length > 0 && (
              <div className="bg-zinc-800/80 border border-white/[0.08] rounded-lg max-h-36 overflow-y-auto">
                {filtered.map((asset) => (
                  <button
                    key={asset}
                    className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors"
                    onClick={() => setSearchQuery(asset.split(' — ')[0])}
                  >
                    {asset}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Trigger Type */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 font-medium uppercase tracking-wider block">Trigger Type</label>
            <div className="flex rounded-lg border border-white/[0.08] overflow-hidden">
              {TRIGGER_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedTrigger(type)}
                  className={`flex-1 px-3 py-2.5 text-xs font-medium transition-all duration-200 ${
                    selectedTrigger === type
                      ? 'bg-violet-600 text-white'
                      : 'bg-white/[0.03] text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-300'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Threshold & Window */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-zinc-500 font-medium uppercase tracking-wider block">Threshold %</label>
              <input
                type="number"
                placeholder="5.0"
                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/[0.08] text-sm text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-zinc-500 font-medium uppercase tracking-wider block">Window (mins)</label>
              <input
                type="number"
                placeholder="5"
                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/[0.08] text-sm text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
          </div>

          <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-violet-900/40">
            <Rocket className="w-4 h-4" />
            Deploy AI Tripwire
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function Dashboard() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [showModal, setShowModal] = useState(false);
  const { livePrices, alerts, setInitialAlerts, updateSubscriptions } = useWebSocket();
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
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
    fetchData();
  }, []);

  const deleteMonitor = async (id: string, symbol: string) => {
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
        onAddMonitor={() => setShowModal(true)}
        onDelete={deleteMonitor}
      />

      <div className="flex-1 flex flex-col min-h-screen">
        <DashboardHeader onLogout={logout} />
        <main className="flex-1 overflow-y-auto">
          <AlertFeed alerts={alerts} />
        </main>
      </div>

      <AddMonitorModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}