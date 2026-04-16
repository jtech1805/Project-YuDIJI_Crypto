// import {
//   createContext,
//   useCallback,
//   useContext,
//   useEffect,
//   useMemo,
//   useRef,
//   useState,
//   type PropsWithChildren,
// } from 'react'

// export type Alert = {
//   id: string
//   symbol: string
//   message: string
//   severity: 'low' | 'medium' | 'high'
//   createdAt: string
// }

// type WebSocketContextValue = {
//   alerts: Alert[]
//   subscribe: (symbols: string[]) => void
// }

// const WebSocketContext = createContext<WebSocketContextValue | undefined>(
//   undefined,
// )

// export function WebSocketProvider({ children }: PropsWithChildren) {
//   const wsRef = useRef<WebSocket | null>(null)
//   const subscriptionsRef = useRef<Set<string>>(new Set())
//   const [alerts, setAlerts] = useState<Alert[]>([])

//   useEffect(() => {
//     const ws = new WebSocket('ws://localhost:3000')
//     wsRef.current = ws

//     ws.onopen = () => {
//       if (subscriptionsRef.current.size > 0) {
//         ws.send(
//           JSON.stringify({
//             type: 'subscribe',
//             symbols: [...subscriptionsRef.current],
//           }),
//         )
//       }
//     }

//     ws.onmessage = (event) => {
//       try {
//         const data = JSON.parse(event.data) as
//           | { type: 'alert'; payload: Alert }
//           | { type: string }
//         if (data.type === 'alert' && 'payload' in data) {
//           setAlerts((prev) => [data.payload, ...prev].slice(0, 100))
//         }
//       } catch {
//         // Ignore non-JSON messages while backend schema evolves.
//       }
//     }

//     return () => {
//       ws.close()
//       wsRef.current = null
//     }
//   }, [])

//   const subscribe = useCallback((symbols: string[]) => {
//     subscriptionsRef.current = new Set(symbols)
//     const ws = wsRef.current
//     if (!ws || ws.readyState !== WebSocket.OPEN) {
//       return
//     }

//     ws.send(
//       JSON.stringify({
//         type: 'subscribe',
//         symbols,
//       }),
//     )
//   }, [])

//   const value = useMemo<WebSocketContextValue>(
//     () => ({ alerts, subscribe }),
//     [alerts, subscribe],
//   )

//   return (
//     <WebSocketContext.Provider value={value}>
//       {children}
//     </WebSocketContext.Provider>
//   )
// }

// export function useWebSocket() {
//   const context = useContext(WebSocketContext)
//   if (!context) {
//     throw new Error('useWebSocket must be used within a WebSocketProvider')
//   }
//   return context
// }
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

interface Alert {
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
  alerts: Alert[];
  updateSubscriptions: (subscribe: string[], unsubscribe: string[]) => void;
  setInitialAlerts: (historicalAlerts: Alert[]) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Connect to your WebSocket server
    const ws = new WebSocket('ws://localhost:3006');
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle Binance Price Ticks
        if (data.currentPrice && data.symbol) {
          setLivePrices((prev) => ({ ...prev, [data.symbol]: parseFloat(data.currentPrice) }));
        }
        
        // Handle AI Alerts
        if (data.type === 'NEW_ALERT' && data.payload) {
          setAlerts((prev) => [data.payload, ...prev]);
        }
      } catch (err) {
        console.error('Error parsing WS message', err);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

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
    <WebSocketContext.Provider value={{ livePrices, alerts, updateSubscriptions, setInitialAlerts }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) throw new Error('useWebSocket must be used within a WebSocketProvider');
  return context;
};