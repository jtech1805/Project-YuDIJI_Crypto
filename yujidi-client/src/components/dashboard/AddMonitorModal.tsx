import { useEffect, useState } from 'react';
import { X, Search, Rocket, Loader2 } from 'lucide-react';
import { apiClient } from '../../api/client';

const TRIGGER_TYPES = ['Price Spike', 'Price Drop'] as const;

interface AddMonitorModalProps {
    open: boolean;
    onClose: () => void;
    // Optional callback to refresh your dashboard data after a new monitor is created
    onSuccess?: () => void;
}

export function AddMonitorModal({ open, onClose, onSuccess }: AddMonitorModalProps) {
    // API States
    const [symbols, setSymbols] = useState<{ symbol: string }[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form States
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSymbol, setSelectedSymbol] = useState('');
    const [selectedTrigger, setSelectedTrigger] = useState<string>('Price Drop');
    const [threshold, setThreshold] = useState('');
    const [timeWindow, setTimeWindow] = useState('');

    // Fetch symbols when the modal opens
    useEffect(() => {
        if (!open) return;

        const fetchSymbols = async () => {
            try {
                const { data } = await apiClient.get('/monitors/symbols');
                const symbolArray = Array.isArray(data) ? data : data.data || [];
                setSymbols(symbolArray);
            } catch (error) {
                console.error('Failed to fetch symbols:', error);
            }
        };

        fetchSymbols();
    }, [open]);

    if (!open) return null;

    // Filter dynamic symbols based on user input
    const filtered = symbols.filter((s) =>
        s.symbol.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAssetSelect = (assetSymbol: string) => {
        setSelectedSymbol(assetSymbol);
        setSearchQuery(assetSymbol); // Update input to show selected asset
    };

    const handleSubmit = async () => {
        if (!selectedSymbol) {
            // You could replace this with a toast notification
            console.error("Please select an asset from the dropdown.");
            return;
        }

        setIsSubmitting(true);
        try {
            // Optional: If your backend requires negative numbers for drops, you can logic that here:
            // const finalThreshold = selectedTrigger === 'Price Drop' ? -Math.abs(Number(threshold)) : Math.abs(Number(threshold));
            const triggervalue: any = {
                'Price Spike': 'spike', 'Price Drop': 'drop'
            }
            await apiClient.post('/monitors', {
                symbol: selectedSymbol,
                thresholdPercentage: Number(threshold),
                timeWindowMinutes: Number(timeWindow),
                trigger: triggervalue[selectedTrigger]
            });

            if (onSuccess) onSuccess();
            onClose();

            // Reset form states for the next time it opens
            setSearchQuery('');
            setSelectedSymbol('');
            setThreshold('5.0');
            setTimeWindow('15');

        } catch (error) {
            console.error('Failed to deploy AI Tripwire:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

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
                    <div className="space-y-2 relative">
                        <label className="text-xs text-zinc-500 font-medium uppercase tracking-wider block">Select Asset</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input
                                placeholder="Search assets (e.g. BTCUSDT)..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setSelectedSymbol(''); // Clear selection if user starts typing again
                                }}
                                className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/[0.08] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                            />
                        </div>

                        {/* Dropdown Menu - Only show if typing and no exact match is selected yet */}
                        {searchQuery && !selectedSymbol && filtered.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-zinc-800 border border-white/[0.08] rounded-lg max-h-48 overflow-y-auto shadow-xl">
                                {filtered.map((s) => (
                                    <button
                                        key={s.symbol}
                                        className="w-full text-left px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/10 hover:text-white transition-colors border-b border-white/[0.02] last:border-0"
                                        onClick={() => handleAssetSelect(s.symbol)}
                                    >
                                        {s.symbol}
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
                                    className={`flex-1 px-3 py-2.5 text-xs font-medium transition-all duration-200 ${selectedTrigger === type
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
                                step="0.1"
                                min="0.1"
                                value={threshold}
                                onChange={(e) => setThreshold(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/[0.08] text-sm text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-zinc-500 font-medium uppercase tracking-wider block">Window (mins)</label>
                            <input
                                type="number"
                                min="1"
                                value={timeWindow}
                                onChange={(e) => setTimeWindow(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/[0.08] text-sm text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !selectedSymbol}
                        className="w-full flex items-center justify-center gap-2 py-3 mt-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-violet-900/40"
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Rocket className="w-4 h-4" />
                        )}
                        {isSubmitting ? 'Deploying...' : 'Deploy AI Tripwire'}
                    </button>
                </div>
            </div>
        </div>
    );
}