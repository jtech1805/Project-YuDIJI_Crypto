// import { useState } from 'react'
// import { z } from 'zod'

// const monitorSchema = z.object({
//   asset: z.string().min(1, 'Asset is required'),
//   triggerType: z.enum(['spike', 'drop'], {
//     error: () => 'Trigger type is required',
//   }),
//   threshold: z
//     .number({ error: () => 'Threshold is required' })
//     .min(0.1, 'Threshold must be at least 0.1%')
//     .max(100, 'Threshold must be 100% or less'),
//   timeframe: z.string().min(1, 'Timeframe is required'),
// })

// type FieldErrors = Partial<Record<keyof z.infer<typeof monitorSchema>, string>>

// export function SetupMonitor() {
//   const [form, setForm] = useState({
//     asset: '',
//     triggerType: 'spike',
//     threshold: '5',
//     timeframe: '15m',
//   })
//   const [errors, setErrors] = useState<FieldErrors>({})
//   const [isSubmitted, setIsSubmitted] = useState(false)

//   const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
//     event.preventDefault()
//     setIsSubmitted(false)

//     const parsed = monitorSchema.safeParse({
//       asset: form.asset,
//       triggerType: form.triggerType,
//       threshold: Number(form.threshold),
//       timeframe: form.timeframe,
//     })

//     if (!parsed.success) {
//       const nextErrors: FieldErrors = {}
//       for (const issue of parsed.error.issues) {
//         const key = issue.path[0] as keyof FieldErrors
//         nextErrors[key] = issue.message
//       }
//       setErrors(nextErrors)
//       return
//     }

//     setErrors({})
//     setIsSubmitted(true)
//   }

//   return (
//     <section className="mx-auto max-w-2xl rounded-xl border border-gray-800 bg-[#111111] p-6">
//       <h1 className="mb-2 text-2xl font-semibold text-purple-300">Setup Monitor</h1>
//       <p className="mb-6 text-sm text-gray-400">
//         Configure conditions for the AI risk engine.
//       </p>

//       <form className="space-y-5" onSubmit={onSubmit}>
//         <div>
//           <label className="mb-1 block text-sm text-gray-300">Asset</label>
//           <select
//             value={form.asset}
//             onChange={(event) =>
//               setForm((prev) => ({ ...prev, asset: event.target.value }))
//             }
//             className="w-full rounded-md border border-gray-800 bg-[#0A0A0A] px-3 py-2 text-gray-100 outline-none ring-purple-500 focus:ring-2"
//           >
//             <option value="">Select asset</option>
//             <option value="BTC/USDT">BTC/USDT</option>
//             <option value="ETH/USDT">ETH/USDT</option>
//             <option value="SOL/USDT">SOL/USDT</option>
//             <option value="XRP/USDT">XRP/USDT</option>
//           </select>
//           {errors.asset ? (
//             <p className="mt-1 text-xs text-red-400">{errors.asset}</p>
//           ) : null}
//         </div>

//         <div>
//           <label className="mb-1 block text-sm text-gray-300">Trigger Type</label>
//           <select
//             value={form.triggerType}
//             onChange={(event) =>
//               setForm((prev) => ({ ...prev, triggerType: event.target.value }))
//             }
//             className="w-full rounded-md border border-gray-800 bg-[#0A0A0A] px-3 py-2 text-gray-100 outline-none ring-purple-500 focus:ring-2"
//           >
//             <option value="spike">Spike</option>
//             <option value="drop">Drop</option>
//           </select>
//         </div>

//         <div>
//           <label className="mb-1 block text-sm text-gray-300">Threshold %</label>
//           <input
//             type="number"
//             step="0.1"
//             min="0.1"
//             max="100"
//             value={form.threshold}
//             onChange={(event) =>
//               setForm((prev) => ({ ...prev, threshold: event.target.value }))
//             }
//             className="w-full rounded-md border border-gray-800 bg-[#0A0A0A] px-3 py-2 text-gray-100 outline-none ring-purple-500 focus:ring-2"
//           />
//           {errors.threshold ? (
//             <p className="mt-1 text-xs text-red-400">{errors.threshold}</p>
//           ) : null}
//         </div>

//         <div>
//           <label className="mb-1 block text-sm text-gray-300">Timeframe</label>
//           <select
//             value={form.timeframe}
//             onChange={(event) =>
//               setForm((prev) => ({ ...prev, timeframe: event.target.value }))
//             }
//             className="w-full rounded-md border border-gray-800 bg-[#0A0A0A] px-3 py-2 text-gray-100 outline-none ring-purple-500 focus:ring-2"
//           >
//             <option value="5m">5m</option>
//             <option value="15m">15m</option>
//             <option value="1h">1h</option>
//             <option value="4h">4h</option>
//           </select>
//           {errors.timeframe ? (
//             <p className="mt-1 text-xs text-red-400">{errors.timeframe}</p>
//           ) : null}
//         </div>

//         <button
//           type="submit"
//           className="rounded-md border border-purple-500/60 bg-purple-500/15 px-4 py-2 font-semibold text-purple-200 transition hover:bg-purple-500/25"
//         >
//           Save Monitor
//         </button>
//       </form>

//       {isSubmitted ? (
//         <p className="mt-5 text-sm text-green-300">
//           Monitor configuration validated and ready for API integration.
//         </p>
//       ) : null}
//     </section>
//   )
// }
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Zap } from 'lucide-react';
import { apiClient } from '../api/client';

export function SetupMonitor() {
  const [symbols, setSymbols] = useState<{ symbol: string }[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [threshold, setThreshold] = useState('5');
  const [timeWindow, setTimeWindow] = useState('15');
  const navigate = useNavigate();
  useEffect(() => {
    const fetchSymbols = async () => {
      try {
        const { data } = await apiClient.get('/monitors/symbols');
        // DEFENSIVE CHECK: Extract the array whether it is raw or wrapped in a 'data' property
        const symbolArray = Array.isArray(data) ? data : (data.data || []);
        
        setSymbols(symbolArray);
        if (symbolArray.length > 0) setSelectedSymbol(symbolArray[0].symbol);
      } catch (error) {
        console.error('Failed to fetch symbols');
      }
    };
    fetchSymbols();
  }, []);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/monitors', {
        symbol: selectedSymbol,
        thresholdPercentage: Number(threshold),
        timeWindowMinutes: Number(timeWindow)
      });
      navigate('/');
    } catch (error) {
      console.error('Failed to create monitor');
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-4 md:p-8">
      <button onClick={() => navigate('/')} className="flex items-center text-zinc-400 hover:text-white mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
      </button>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto bg-zinc-900/50 border border-white/5 rounded-2xl p-6 md:p-8"
      >
        <h1 className="text-2xl font-bold text-white mb-6 flex items-center">
          <Zap className="w-6 h-6 text-purple-500 mr-3" /> Setup AI Tripwire
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Select Asset</label>
            <select 
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
            >
              {symbols.map(s => (
                <option key={s.symbol} value={s.symbol}>{s.symbol}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Threshold (%)</label>
              <input 
                type="number" step="0.1" min="0.1"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Timeframe (mins)</label>
              <input 
                type="number" min="1"
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-4 rounded-xl transition-colors mt-8"
          >
            Deploy AI Tripwire
          </button>
        </form>
      </motion.div>
    </div>
  );
}