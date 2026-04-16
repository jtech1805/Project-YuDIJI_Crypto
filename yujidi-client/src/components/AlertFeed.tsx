import { Sparkles, TrendingDown, TrendingUp, AlertTriangle, BarChart3 } from "lucide-react";
import { Button } from "../components/ui/button";
import { useWebSocket } from "../context/WebSocketContext";
import { formatDistanceToNow } from "date-fns"; // Make sure to npm install date-fns

const urgencyStyles: Record<string, string> = {
  Bullish: "bg-primary/10 text-bullish border-primary/20",
  Bearish: "bg-destructive/10 text-bearish border-destructive/20",
  Panic: "bg-destructive/10 text-bearish border-destructive/20",
  Neutral: "bg-accent/10 text-accent border-accent/20",
};

function AlertCard({ alert }: { alert: any }) {
  const isDrop = alert.dropPercentage > 0;

  return (
    <div className="glass-card p-6 hover:border-white/[0.12] transition-all duration-300 animate-slide-up group">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-foreground">
            {alert.symbol.slice(0, 3)}
          </div>
          <div>
            <span className="font-semibold text-foreground">{alert.symbol}</span>
            <span className="text-xs text-muted-foreground ml-2">
              {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${urgencyStyles[alert.sentiment] || urgencyStyles.Neutral}`}>
          {alert.sentiment}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {isDrop ? <TrendingDown className="w-5 h-5 text-bearish flex-shrink-0" /> : <TrendingUp className="w-5 h-5 text-bullish flex-shrink-0" />}
        <p className="text-foreground font-semibold text-lg">
          {alert.symbol} {isDrop ? 'dropped' : 'moved'} {alert.dropPercentage}%
        </p>
      </div>

      <div className="bg-secondary/40 border border-accent/10 rounded-lg p-4 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="text-xs font-semibold text-accent uppercase tracking-wider">AI Root Cause Analysis</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{alert.aiRootCause}</p>
      </div>

      <div className="flex items-center gap-3">
        <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs transition-all duration-200">
          <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Full Report
        </Button>
      </div>
    </div>
  );
}

export function AlertFeed() {
  const { alerts } = useWebSocket();

  return (
    <div className="space-y-4 p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-foreground">Intelligence Feed</h2>
        <span className="text-xs text-muted-foreground font-mono">
          <AlertTriangle className="w-3 h-3 inline mr-1 text-primary" />
          {alerts.length} reports
        </span>
      </div>
      {alerts.length === 0 && <div className="text-muted-foreground text-sm">Awaiting market anomalies...</div>}
      {alerts.map((alert) => (
        <AlertCard key={alert._id} alert={alert} />
      ))}
    </div>
  );
}