import { Search, Wifi, LogOut } from "lucide-react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

interface DashboardHeaderProps {
  onLogout: () => void;
}

export function DashboardHeader({ onLogout }: DashboardHeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-card/30 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search assets..." className="pl-9 bg-secondary/40 border-border text-sm h-9 focus:border-primary/50" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wifi className="w-3.5 h-3.5 text-bullish animate-pulse" />
          <span className="text-bullish font-medium">Live Server</span>
        </div>
        <div className="w-px h-5 bg-border" />
        <Button variant="ghost" size="icon" onClick={onLogout} className="text-muted-foreground hover:text-foreground h-8 w-8">
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}