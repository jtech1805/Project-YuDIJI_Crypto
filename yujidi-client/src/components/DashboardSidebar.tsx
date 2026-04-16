import { Plus, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { useWebSocket } from "../context/WebSocketContext";
import { apiClient } from "../api/client";

interface AssetItemProps {
  monitor: any;
  livePrice: number;
  onDelete: (id: string) => void;
}

function AssetItem({ monitor, livePrice, onDelete }: AssetItemProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 rounded-lg transition-colors cursor-pointer group">
      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0">
        {monitor.symbol.slice(0, 3)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">{monitor.symbol}</span>
          <button onClick={() => onDelete(monitor._id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-foreground">Alert at {monitor.thresholdPercentage}% drop</span>
          <span className="text-xs font-mono text-foreground">${livePrice?.toLocaleString() || '---'}</span>
        </div>
      </div>
    </div>
  );
}

interface DashboardSidebarProps {
  monitors: any[];
  onAddMonitor: () => void;
  refreshData: () => void;
}

export function DashboardSidebar({ monitors, onAddMonitor, refreshData }: DashboardSidebarProps) {
  const { livePrices } = useWebSocket();

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/monitors/${id}`);
      refreshData();
    } catch (error) {
      console.error("Delete failed");
    }
  };

  return (
    <aside className="w-72 border-r border-border bg-card/30 flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
            <span className="text-primary text-xs font-bold">Y</span>
          </div>
          <span className="font-semibold text-foreground text-sm">YuJiDi Engine</span>
        </div>
        <Button onClick={onAddMonitor} className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-medium text-sm transition-all duration-200" variant="outline">
          <Plus className="w-4 h-4 mr-2" /> Add Monitor
        </Button>
      </div>
      <div className="p-3 flex-1 overflow-y-auto">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider px-4 mb-2 block">Active Tripwires</span>
        <div className="space-y-1 mt-3">
          {monitors.length === 0 && <p className="text-xs text-muted-foreground px-4 text-center mt-6">No active tripwires.</p>}
          {monitors.map((monitor) => (
            <AssetItem
              key={monitor._id}
              monitor={monitor}
              livePrice={livePrices[monitor.symbol]}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}