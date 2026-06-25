import { Activity, LogOut, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import type {
  ActiveTrade,
  ActiveTradeEvaluation,
  CloseActiveTradeInput,
  TradeEvent,
} from '../../types/trade'
import { buttonClass, EmptyState, inputClass, PermissionBadge, Section } from './trading-ui'

const exitReasons: CloseActiveTradeInput['exitReason'][] = [
  'MANUAL_EXIT',
  'STOPLOSS',
  'TARGET_1',
  'TARGET_2',
  'TRAILING_STOP',
  'TIME_EXIT',
  'RISK_EXIT',
]

export function ActiveTradePanel({
  trades,
  events,
  busy,
  onEvaluate,
  onClose,
}: {
  trades: ActiveTrade[]
  events: TradeEvent[]
  busy: boolean
  onEvaluate: (id: string, price: number) => Promise<ActiveTradeEvaluation>
  onClose: (id: string, input: CloseActiveTradeInput) => Promise<void>
}) {
  const [evaluationPrices, setEvaluationPrices] = useState<Record<string, string>>({})
  const [closeDraft, setCloseDraft] = useState<{
    tradeId: string
    exitPrice: string
    exitReason: CloseActiveTradeInput['exitReason'] | ''
    exitNotes: string
  } | null>(null)
  const [lastEvaluation, setLastEvaluation] = useState<ActiveTradeEvaluation | null>(null)
  const openTrades = trades.filter((trade) => ['ACTIVE', 'PARTIALLY_EXITED'].includes(trade.status))
  const uniqueEvents = events.filter((event, index, collection) => {
    const id = event.tradeEventId ?? event._id
    if (!id) return true
    return collection.findIndex((candidate) => (candidate.tradeEventId ?? candidate._id) === id) === index
  })

  return (
    <Section title="Active Trades And Events">
      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <div className="space-y-3">
          {openTrades.length === 0 ? (
            <EmptyState>No active trades</EmptyState>
          ) : (
            openTrades.map((trade) => (
              <div key={trade._id} className="border border-white/8 bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {trade.symbolSnapshot?.displayName ?? 'Unknown symbol'} · {trade.direction}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {trade.status} · Qty {trade.remainingQuantity} · Risk {trade.actualRiskAmount}
                    </p>
                  </div>
                  <PermissionBadge permission={trade.finalPermissionAtExecution} />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="border border-white/6 bg-black/20 p-3">
                    <p className="text-[10px] font-semibold uppercase text-zinc-600">
                      Planned setup · historical
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-zinc-400">
                      <span>Entry <b className="block font-mono text-zinc-300">{trade.plannedEntry}</b></span>
                      <span>Stop <b className="block font-mono text-zinc-300">{trade.plannedStopLoss}</b></span>
                      <span>Target <b className="block font-mono text-zinc-300">{trade.plannedTarget1}</b></span>
                    </div>
                  </div>
                  <div className="border border-cyan-500/15 bg-cyan-500/5 p-3">
                    <p className="text-[10px] font-semibold uppercase text-cyan-400/70">
                      Current actual trade
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-zinc-400">
                      <span>Entry <b className="block font-mono text-white">{trade.actualEntry}</b></span>
                      <span>Stop <b className="block font-mono text-white">{trade.currentStopLoss}</b></span>
                      <span>Target 1 <b className="block font-mono text-white">{trade.actualTarget1}</b></span>
                      <span>Target 2 <b className="block font-mono text-white">{trade.actualTarget2 ?? '—'}</b></span>
                      <span>Actual R:R <b className="block font-mono text-white">{trade.actualRewardRiskRatio}</b></span>
                      <span>Status <b className="block text-white">{trade.status}</b></span>
                    </div>
                  </div>
                </div>
                {trade.ruleViolations && trade.ruleViolations.length > 0 && (
                  <div className="mt-3 border border-red-500/20 bg-red-500/5 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase text-red-300">Rule violations</p>
                    <p className="mt-1 text-xs text-red-200">{trade.ruleViolations.join(' · ')}</p>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    className={`${inputClass} w-40`}
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Current price"
                    value={evaluationPrices[trade._id] ?? ''}
                    onChange={(event) =>
                      setEvaluationPrices({
                        ...evaluationPrices,
                        [trade._id]: event.target.value,
                      })
                    }
                  />
                  <button
                    className={buttonClass}
                    disabled={busy || !(Number(evaluationPrices[trade._id]) > 0)}
                    type="button"
                    onClick={() =>
                      void onEvaluate(trade._id, Number(evaluationPrices[trade._id])).then(
                        setLastEvaluation,
                      ).catch(() => undefined)
                    }
                  >
                    <RefreshCw className="h-4 w-4" />
                    Manual evaluate
                  </button>
                  <button
                    className={buttonClass}
                    type="button"
                    onClick={() =>
                      setCloseDraft({
                        tradeId: trade._id,
                        exitPrice: '',
                        exitReason: '',
                        exitNotes: '',
                      })
                    }
                  >
                    <LogOut className="h-4 w-4" />
                    Manual close
                  </button>
                </div>
                {lastEvaluation?.activeTradeId === trade._id && (
                  <p className="mt-3 text-xs text-cyan-300">
                    Current R {lastEvaluation.currentR.toFixed(2)} ·{' '}
                    {lastEvaluation.events.length} new trade event(s)
                  </p>
                )}
                {closeDraft?.tradeId === trade._id && (
                  <div className="mt-3 grid gap-2 border-t border-white/8 pt-3 md:grid-cols-3">
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Exit price"
                      value={closeDraft.exitPrice}
                      onChange={(event) =>
                        setCloseDraft({ ...closeDraft, exitPrice: event.target.value })
                      }
                    />
                    <select
                      className={inputClass}
                      value={closeDraft.exitReason}
                      onChange={(event) =>
                        setCloseDraft({
                          ...closeDraft,
                          exitReason: event.target.value as CloseActiveTradeInput['exitReason'],
                        })
                      }
                    >
                      <option value="">Select exit reason</option>
                      {exitReasons.map((reason) => <option key={reason}>{reason}</option>)}
                    </select>
                    <input
                      className={inputClass}
                      placeholder="Exit notes"
                      value={closeDraft.exitNotes}
                      onChange={(event) =>
                        setCloseDraft({ ...closeDraft, exitNotes: event.target.value })
                      }
                    />
                    {Number(closeDraft.exitPrice) > 0 && (
                      <div className="border border-white/8 bg-black/20 px-3 py-2 text-xs text-zinc-400 md:col-span-3">
                        Estimated gross P&amp;L:{' '}
                        <span className="font-mono text-white">
                          {(
                            (trade.direction === 'LONG'
                              ? Number(closeDraft.exitPrice) - trade.actualEntry
                              : trade.actualEntry - Number(closeDraft.exitPrice)) *
                            trade.remainingQuantity
                          ).toFixed(2)}
                        </span>
                        <span className="ml-2 text-zinc-600">Excludes fees and charges.</span>
                      </div>
                    )}
                    <p className="text-xs leading-5 text-amber-200 md:col-span-3">
                      Closing here records your result in YuJiDi. It does not place a broker order.
                    </p>
                    <button
                      className={`${buttonClass} md:col-span-3`}
                      disabled={
                        busy ||
                        !(Number(closeDraft.exitPrice) > 0) ||
                        !closeDraft.exitReason
                      }
                      type="button"
                      onClick={() =>
                        void onClose(trade._id, {
                          exitPrice: Number(closeDraft.exitPrice),
                          exitReason: closeDraft.exitReason as CloseActiveTradeInput['exitReason'],
                          ...(closeDraft.exitNotes ? { exitNotes: closeDraft.exitNotes } : {}),
                          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        }).then(() => setCloseDraft(null))
                      }
                    >
                      Confirm manual close
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="max-h-[34rem] overflow-y-auto border border-white/8 bg-black/20">
          <div className="sticky top-0 flex items-center gap-2 border-b border-white/8 bg-zinc-950 px-3 py-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-semibold uppercase text-zinc-400">Trade event feed</span>
          </div>
          <div className="border-b border-amber-500/15 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200">
            This is an alert, not an execution. Trade events never close a trade automatically.
          </div>
          {uniqueEvents.length === 0 ? (
            <div className="p-5 text-center text-sm text-zinc-600">No trade events</div>
          ) : (
            uniqueEvents.slice(0, 30).map((event) => (
              <div
                key={event.tradeEventId ?? event._id}
                className="border-b border-white/6 px-3 py-3 last:border-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-semibold ${
                      event.severity === 'CRITICAL'
                        ? 'text-red-300'
                        : event.severity === 'WARNING'
                          ? 'text-amber-300'
                          : 'text-cyan-300'
                    }`}
                  >
                    {event.eventType.replaceAll('_', ' ')}
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    {new Date(event.occurredAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-300">{event.message}</p>
                <p className="mt-1 font-mono text-[11px] text-zinc-500">
                  {event.displayName ?? event.symbolSnapshot?.displayName ?? event.symbol ?? 'Unknown symbol'} · {event.price}
                  {event.currentR !== undefined ? ` · ${event.currentR.toFixed(2)}R` : ''}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </Section>
  )
}
