import { useState, useEffect } from "react";
import { X, Rocket, Search } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { apiClient } from "../api/client";

interface AddMonitorModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const triggerTypes = ["Price Drop", "Price Spike"] as const;

export function AddMonitorModal({ open, onClose, onSuccess }: AddMonitorModalProps) {
  const [selectedTrigger, setSelectedTrigger] = useState<string>("Price Drop");
  const [searchQuery, setSearchQuery] = useState("");
  const [symbols, setSymbols] = useState<{ symbol: string }[]>([]);
  const [threshold, setThreshold] = useState("5");
  const [timeWindow, setTimeWindow] = useState("15");
  const [isDeploying, setIsDeploying] = useState(false);

  useEffect(() => {
    if (open) {
      const fetchSymbols = async () => {
        try {
          const { data } = await apiClient.get('/monitors/symbols');
          const symbolArray = Array.isArray(data) ? data : (data?.data || []);
          setSymbols(symbolArray);
        } catch (error) {
          console.error('Failed to fetch symbols', error);
        }
      };
      fetchSymbols();
    }
  }, [open]);

  if (!open) return null;

  const filteredAssets = symbols.filter((a) => a.symbol.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleDeploy = async () => {
    if (!searchQuery) return;
    setIsDeploying(true);
    try {
      await apiClient.post('/monitors', {
        symbol: searchQuery.toUpperCase(),
        thresholdPercentage: Number(threshold),
        timeWindowMinutes: Number(timeWindow)
      });
      onSuccess(); // Refresh the dashboard
      onClose();   // Close modal
    } catch (error) {
      console.error("Failed to deploy tripwire", error);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div className="relative glass-card glow-green w-full max-w-lg mx-4 p-8 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-foreground mb-1">Deploy New Tripwire</h2>
        <p className="text-sm text-muted-foreground mb-6">Configure your AI-powered monitoring agent.</p>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Select Asset (e.g. BTCUSDT)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-secondary/50 border-border uppercase"
              />
            </div>
            {searchQuery && filteredAssets.length > 0 && filteredAssets.length < 50 && (
              <div className="bg-secondary/60 border border-border rounded-lg max-h-32 overflow-y-auto">
                {filteredAssets.map((asset) => (
                  <button
                    key={asset.symbol}
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                    onClick={() => setSearchQuery(asset.symbol)}
                  >
                    {asset.symbol}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Trigger Type</Label>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {triggerTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedTrigger(type)}
                  className={`flex-1 px-3 py-2.5 text-xs font-medium transition-all duration-200 ${
                    selectedTrigger === type ? "bg-primary text-primary-foreground" : "bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Threshold %</Label>
              <Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="bg-secondary/50 border-border font-mono" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Time Window (mins)</Label>
              <Input type="number" value={timeWindow} onChange={(e) => setTimeWindow(e.target.value)} className="bg-secondary/50 border-border font-mono" />
            </div>
          </div>

          <Button onClick={handleDeploy} disabled={isDeploying} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-12 text-sm transition-all duration-200 glow-green">
            <Rocket className="w-4 h-4 mr-2" />
            {isDeploying ? 'Deploying...' : 'Deploy AI Tripwire'}
          </Button>
        </div>
      </div>
    </div>
  );
}