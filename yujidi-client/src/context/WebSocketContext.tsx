import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import type { TradeEvent } from '../types/trade';
// const isProd = import.meta.env.PROD;
// Notice the 'wss://' for production!
// const WS_URL = isProd
//   ? 'wss://project-yudiji-crypto.onrender.com'
//   : 'ws://localhost:3006';
// Export the WebSocket URL for your real-time data streams
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3006';
export interface Alert {
  _id: string;
  symbol: string;
  triggerPrice: number;
  dropPercentage: number;
  changePercentage?: number;
  triggerType?: 'drop' | 'spike';
  direction?: 'up' | 'down';
  catalyst: string;
  threatLevel: string;
  support: string;
  resistance: string;
  summary: string;
  cvdAtTrigger: number;
  createdAt: string;
}
export interface MonitorStatus {
  monitorId: string;
  symbol: string;
  triggerType: 'drop' | 'spike';
  thresholdPercentage: number;
  timeWindowMinutes: number;
  historyReady: boolean;
  historyCoveredMs: number;
  requiredHistoryMs: number;
  changePercentage?: number;
  movementMagnitude?: number;
  triggerMovementPercentage?: number;
  direction?: 'up' | 'down';
  thresholdBreached: boolean;
  evaluatedAt: number;
}

interface WebSocketContextType {
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  livePrices: Record<string, number>;
  livePriceschange: Record<string, number>;
  monitorStatuses: Record<string, MonitorStatus>;
  alerts: Alert[];
  tradeEvents: TradeEvent[];
  updateSubscriptions: (subscribe: string[], unsubscribe: string[]) => void;
  setInitialAlerts: (historicalAlerts: Alert[]) => void;
  setInitialTradeEvents: (historicalEvents: TradeEvent[]) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

const normalizeLivePriceKey = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim()
    ? value.trim().toUpperCase()
    : null;
};

const livePriceKeysFromPayload = (data: Record<string, unknown>): string[] => {
  const directKeys = [
    normalizeLivePriceKey(data.symbol),
    normalizeLivePriceKey(data.displayName),
    normalizeLivePriceKey(data.providerSymbol),
    normalizeLivePriceKey(data.instrumentToken),
  ];

  const provider = normalizeLivePriceKey(data.provider);
  const exchange = normalizeLivePriceKey(data.exchange);
  const instrumentToken = normalizeLivePriceKey(data.instrumentToken);
  const providerAwareKey = provider && exchange && instrumentToken
    ? `${provider}:${exchange}:${instrumentToken}`
    : null;

  return Array.from(new Set([...directKeys, providerAwareKey].filter((key): key is string => Boolean(key))));
};

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [livePriceschange, setLivePriceschange] = useState<Record<string, number>>({});
  const [monitorStatuses, setMonitorStatuses] = useState<Record<string, MonitorStatus>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [tradeEvents, setTradeEvents] = useState<TradeEvent[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<WebSocketContextType['connectionStatus']>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const desiredSubscriptionsRef = useRef<Set<string>>(new Set());
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      desiredSubscriptionsRef.current.clear();
      setLivePrices({});
      setLivePriceschange({});
      setMonitorStatuses({});
      setAlerts([]);
      setTradeEvents([]);
      setConnectionStatus('disconnected');
      return;
    }

    let stopped = false;
    let reconnectTimer: number | undefined;

    const connect = () => {
      if (stopped || wsRef.current) return;
      setConnectionStatus('connecting');
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        const subscriptions = Array.from(desiredSubscriptionsRef.current);
        if (subscriptions.length > 0) {
          ws.send(JSON.stringify({
            action: 'UPDATE_SUBSCRIPTIONS',
            subscribe: subscriptions,
            unsubscribe: [],
          }));
        }
      };
      ws.onerror = () => setConnectionStatus('disconnected');
      ws.onclose = () => {
        setConnectionStatus('disconnected');
        if (wsRef.current === ws) wsRef.current = null;
        if (!stopped) {
          reconnectTimer = window.setTimeout(connect, 1500);
        }
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'SUBSCRIPTION_UPDATE_RESULT' && data.data?.failed?.length) {
            console.warn('WebSocket subscription failures', data.data.failed);
          }
          const livePriceKeys = livePriceKeysFromPayload(data);
          const rawPrice = data.currentPrice ?? data.price;
          const price = typeof rawPrice === 'number' ? rawPrice : Number.parseFloat(rawPrice);
          const change = Number.parseFloat(data.priceChangePercent);
          if (livePriceKeys.length > 0 && Number.isFinite(price)) {
            setLivePrices((prev) => {
              const next = { ...prev };
              for (const key of livePriceKeys) {
                next[key] = price;
              }
              return next;
            });
            if (Number.isFinite(change)) {
              setLivePriceschange((prev) => {
                const next = { ...prev };
                for (const key of livePriceKeys) {
                  next[key] = change;
                }
                return next;
              });
            }
          }
          if (data.type === 'NEW_ALERT' && data.payload) {
            setAlerts((prev) => [data.payload, ...prev]);
          }
          if (data.type === 'MONITOR_STATUS' && data.payload?.monitorId) {
            setMonitorStatuses((previous) => ({
              ...previous,
              [data.payload.monitorId]: data.payload as MonitorStatus,
            }));
          }
          if (data.type === 'TRADE_EVENT_CREATED' && data.payload) {
            setTradeEvents((previous) => {
              const eventId = data.payload.tradeEventId;
              if (eventId && previous.some((item) => (item.tradeEventId ?? item._id) === eventId)) {
                return previous;
              }
              return [data.payload as TradeEvent, ...previous].slice(0, 100);
            });
          }
        } catch (err) {
          console.error('Error parsing WS message', err);
        }
      };
    };

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [user]);

  const updateSubscriptions = useCallback((subscribe: string[], unsubscribe: string[]) => {
    const normalizedSubscribe = subscribe
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean);
    const normalizedUnsubscribe = unsubscribe
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean);

    for (const symbol of normalizedSubscribe) {
      desiredSubscriptionsRef.current.add(symbol);
    }
    for (const symbol of normalizedUnsubscribe) {
      desiredSubscriptionsRef.current.delete(symbol);
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'UPDATE_SUBSCRIPTIONS',
        subscribe: normalizedSubscribe,
        unsubscribe: normalizedUnsubscribe,
      }));
    }
  }, []);

  // Used by the Dashboard to load historical alerts on mount
  const setInitialAlerts = useCallback((historicalAlerts: Alert[]) => {
    setAlerts(historicalAlerts);
  }, []);

  const setInitialTradeEvents = useCallback((historicalEvents: TradeEvent[]) => {
    setTradeEvents((current) => {
      const combined = [...current, ...historicalEvents];
      const seen = new Set<string>();
      return combined.filter((event) => {
        const id = event.tradeEventId ?? event._id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      }).slice(0, 100);
    });
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        livePrices,
        connectionStatus,
        livePriceschange,
        monitorStatuses,
        alerts,
        tradeEvents,
        updateSubscriptions,
        setInitialAlerts,
        setInitialTradeEvents,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) throw new Error('useWebSocket must be used within a WebSocketProvider');
  return context;
};
