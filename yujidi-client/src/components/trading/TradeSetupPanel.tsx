import { Ban, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import type { ConfirmActualTradeInput, TradeSetup } from '../../types/trade'
import { buttonClass, EmptyState, inputClass, PermissionBadge, Section } from './trading-ui'

type ConfirmationDraft = {
  actualEntry: string
  actualQuantity: string
  initialStopLoss: string
  actualTarget1: string
  actualTarget2: string
}

export function TradeSetupPanel({
  setups,
  busy,
  onConfirm,
  onCancel,
}: {
  setups: TradeSetup[]
  busy: boolean
  onConfirm: (id: string, input: ConfirmActualTradeInput) => Promise<void>
  onCancel: (id: string) => Promise<void>
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ConfirmationDraft>({
    actualEntry: '',
    actualQuantity: '1',
    initialStopLoss: '',
    actualTarget1: '',
    actualTarget2: '',
  })

  const startConfirmation = (setup: TradeSetup) => {
    setConfirmingId(setup._id)
    setDraft({
      actualEntry: String(setup.plannedEntry),
      actualQuantity: '1',
      initialStopLoss: String(setup.plannedStopLoss),
      actualTarget1: String(setup.plannedTarget1),
      actualTarget2: setup.plannedTarget2 ? String(setup.plannedTarget2) : '',
    })
  }

  return (
    <Section title="Governed Trade Setups">
      {setups.length === 0 ? (
        <EmptyState>No trade setups yet</EmptyState>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {setups.slice(0, 8).map((setup) => (
            <div key={setup._id} className="border border-white/8 bg-white/[0.02] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">
                    {setup.symbolSnapshot.displayName} · {setup.direction}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {setup.status} · Planned R:R {setup.plannedRewardRiskRatio.toFixed(2)}
                  </p>
                </div>
                <PermissionBadge permission={setup.finalPermission} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <Metric label="Entry" value={setup.plannedEntry} />
                <Metric label="Stoploss" value={setup.plannedStopLoss} />
                <Metric label="Target 1" value={setup.plannedTarget1} />
              </div>

              {confirmingId === setup._id && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(
                    [
                      ['actualEntry', 'Actual entry'],
                      ['actualQuantity', 'Quantity'],
                      ['initialStopLoss', 'Initial stoploss'],
                      ['actualTarget1', 'Actual target 1'],
                      ['actualTarget2', 'Actual target 2'],
                    ] as const
                  ).map(([field, label]) => (
                    <input
                      key={field}
                      className={inputClass}
                      type="number"
                      min="0"
                      step="any"
                      placeholder={label}
                      value={draft[field]}
                      onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                    />
                  ))}
                  <button
                    className={`${buttonClass} col-span-2`}
                    disabled={
                      busy ||
                      !(
                        Number(draft.actualEntry) > 0 &&
                        Number(draft.actualQuantity) > 0 &&
                        Number(draft.initialStopLoss) > 0 &&
                        Number(draft.actualTarget1) > 0
                      )
                    }
                    type="button"
                    onClick={() =>
                      void onConfirm(setup._id, {
                        actualEntry: Number(draft.actualEntry),
                        actualQuantity: Number(draft.actualQuantity),
                        initialStopLoss: Number(draft.initialStopLoss),
                        actualTarget1: Number(draft.actualTarget1),
                        ...(Number(draft.actualTarget2) > 0
                          ? { actualTarget2: Number(draft.actualTarget2) }
                          : {}),
                        executionSource: 'MANUAL_CONFIRMATION',
                      }).then(() => setConfirmingId(null))
                    }
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm actual trade
                  </button>
                </div>
              )}

              <div className="mt-3 flex gap-2">
                {setup.status === 'APPROVED' && confirmingId !== setup._id && (
                  <button className={buttonClass} type="button" onClick={() => startConfirmation(setup)}>
                    Confirm actual trade
                  </button>
                )}
                {['DRAFT', 'APPROVED', 'REJECTED'].includes(setup.status) && (
                  <button
                    className={buttonClass}
                    disabled={busy}
                    type="button"
                    onClick={() => void onCancel(setup._id)}
                  >
                    <Ban className="h-4 w-4" />
                    Cancel setup
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-white/6 bg-black/20 p-2">
      <span className="block text-[10px] uppercase text-zinc-600">{label}</span>
      <span className="font-mono text-zinc-300">{value}</span>
    </div>
  )
}
