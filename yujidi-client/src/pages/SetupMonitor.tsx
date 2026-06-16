import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Zap } from 'lucide-react';
import { apiClient } from '../api/client';
import { type SymbolSearchResult } from '../api/symbols';
import { useSymbolSearch } from '../hooks/useSymbolSearch';

export function SetupMonitor() {
  const [query, setQuery] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState<SymbolSearchResult | null>(null);
  const [threshold, setThreshold] = useState('5');
  const [timeWindow, setTimeWindow] = useState('15');
  const { results, isLoading } = useSymbolSearch(query, { limit: 20 });
  const navigate = useNavigate();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSymbol) return;
    try {
      await apiClient.post('/monitors', {
        symbolId: selectedSymbol.symbolId,
        thresholdPercentage: Number(threshold),
        timeWindowMinutes: Number(timeWindow),
        trigger: 'drop',
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
            <label className="block text-sm font-medium text-zinc-400 mb-2">Search Asset</label>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedSymbol(null);
              }}
              placeholder="Type at least 2 characters..."
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
            />
            {query.trim().length >= 2 && !selectedSymbol && (
              <div className="mt-2 bg-black/70 border border-white/10 rounded-lg max-h-48 overflow-y-auto">
                {isLoading && <div className="px-4 py-3 text-sm text-zinc-500">Searching...</div>}
                {!isLoading && results.map((result) => (
                  <button
                    type="button"
                    key={result.symbolId}
                    onClick={() => {
                      setSelectedSymbol(result);
                      setQuery(result.displayName || result.symbol);
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-white/10"
                  >
                    <span className="block text-white">{result.displayName || result.symbol}</span>
                    <span className="text-xs text-zinc-500">
                      {[result.provider, result.exchange, result.instrumentType].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                ))}
              </div>
            )}
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
            disabled={!selectedSymbol}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-4 rounded-xl transition-colors mt-8"
          >
            Deploy AI Tripwire
          </button>
        </form>
      </motion.div>
    </div>
  );
}
