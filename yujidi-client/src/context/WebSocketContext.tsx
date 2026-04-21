import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
const isProd = import.meta.env.PROD;
// Notice the 'wss://' for production!
const WS_URL = isProd
  ? 'wss://project-yudiji-crypto.onrender.com'
  : 'ws://localhost:3006';
export interface Alert {
  _id: string;
  symbol: string;
  triggerPrice: number;
  dropPercentage: number;
  aiRootCause: string;
  sentiment: 'Panic' | 'Bearish' | 'Neutral' | 'Bullish';
  createdAt: string;
}

interface WebSocketContextType {
  livePrices: Record<string, number>;
  livePriceschange: Record<string, number>;
  alerts: Alert[];
  updateSubscriptions: (subscribe: string[], unsubscribe: string[]) => void;
  setInitialAlerts: (historicalAlerts: Alert[]) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [livePriceschange, setLivePriceschange] = useState<Record<string, number>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const { user } = useAuth();

  // useEffect(() => {
  //   // Connect to your WebSocket server
  //   const ws = new WebSocket(WS_URL);
  //   wsRef.current = ws;

  //   ws.onmessage = (event) => {
  //     try {
  //       const data = JSON.parse(event.data);

  //       // Handle Binance Price Ticks
  //       if (data.currentPrice && data.symbol) {
  //         setLivePrices((prev) => ({ ...prev, [data.symbol]: parseFloat(data.currentPrice) }));
  //       }

  //       // Handle AI Alerts
  //       if (data.type === 'NEW_ALERT' && data.payload) {
  //         setAlerts((prev) => [data.payload, ...prev]);
  //       }
  //     } catch (err) {
  //       console.error('Error parsing WS message', err);
  //     }
  //   };

  //   return () => {
  //     ws.close();
  //   };
  // }, []);
  useEffect(() => {
    // 1. Connect if user logs in
    if (user && !wsRef.current) {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.currentPrice && data.symbol) {
            setLivePrices((prev) => ({ ...prev, [data.symbol]: parseFloat(data.currentPrice) }));
            setLivePriceschange((prev) => ({ ...prev, [data.symbol]: parseFloat(data.priceChangePercent) }));
          }
          if (data.type === 'NEW_ALERT' && data.payload) {
            setAlerts((prev) => [data.payload, ...prev]);
          }
        } catch (err) {
          console.error('Error parsing WS message', err);
        }
      };
    }

    // 2. Disconnect and wipe data if user logs out
    if (!user && wsRef.current) {
      console.log('User logged out. Closing WebSocket...');

      // Force close the socket. Your backend will automatically detect this 
      // via the 'close' event and clear the memory on the server side.
      wsRef.current.close();
      wsRef.current = null;

      // Wipe the frontend memory
      setLivePrices({});
      setAlerts([]);
    }

    // 3. Safety cleanup on unmount
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
    // CRITICAL FIX: Only watch 'user'. Do NOT watch 'livePrices' here!
  }, [user]);

  const updateSubscriptions = (subscribe: string[], unsubscribe: string[]) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'UPDATE_SUBSCRIPTIONS', subscribe, unsubscribe }));
    } else if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
      // If still connecting, wait a second and try again
      setTimeout(() => updateSubscriptions(subscribe, unsubscribe), 1000);
    }
  };

  // Used by the Dashboard to load historical alerts on mount
  const setInitialAlerts = (historicalAlerts: Alert[]) => {
    setAlerts(historicalAlerts);
  };

  return (
    <WebSocketContext.Provider value={{ livePrices, livePriceschange, alerts, updateSubscriptions, setInitialAlerts }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) throw new Error('useWebSocket must be used within a WebSocketProvider');
  return context;
};