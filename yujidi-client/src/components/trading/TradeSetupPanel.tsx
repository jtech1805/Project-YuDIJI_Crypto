import { Ban, CheckCircle2, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { ConfirmActualTradeInput, TradeSetup } from '../../types/trade'
import {
  buttonClass,
  DeleteConfirmDialog,
  EmptyState,
  inputClass,
  panelClass,
  PermissionBadge,
  Section,
} from './trading-ui'

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
  onRetry,
  onDelete,
}: {
  setups: TradeSetup[]
  busy: boolean
  onConfirm: (id: string, input: ConfirmActualTradeInput) => Promise<void>
  onCancel: (id: string) => Promise<void>
  onRetry: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
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
    <Section title="Governed Setups">
      {setups.length === 0 ? (
        <EmptyState>No governed setups yet</EmptyState>
      ) : (
        <div className={`${panelClass} overflow-hidden`}>
          <div className="max-h-[28rem] overflow-auto">
            <table className="hidden min-w-full text-left text-xs lg:table">
              <thead className="sticky top-0 bg-zinc-950 text-[10px] uppercase text-zinc-600">
                <tr>
                  <th className="px-3 py-2">Symbol</th>
                  <th className="px-3 py-2">Dir</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Entry</th>
                  <th className="px-3 py-2">SL</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">R:R</th>
                  <th className="px-3 py-2">Permission</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {setups.slice(0, 20).map((setup) => (
                  <SetupRow
                    key={setup._id}
                    setup={setup}
                    busy={busy}
                    confirming={confirmingId === setup._id}
                    draft={draft}
                    onDraft={setDraft}
                    onStartConfirmation={startConfirmation}
                    onCancelConfirmation={() => setConfirmingId(null)}
                    onConfirm={onConfirm}
                    onCancel={onCancel}
                    onRetry={onRetry}
                    onDelete={setDeleteId}
                  />
                ))}
              </tbody>
            </table>
            <div className="grid gap-2 p-3 lg:hidden">
              {setups.slice(0, 20).map((setup) => (
                <div key={setup._id} className="rounded-md border border-white/8 bg-white/[0.02] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-white">{setup.symbolSnapshot.displayName} · {setup.direction}</p>
                      <p className="mt-1 text-xs text-zinc-500">{setup.status} · R:R {setup.plannedRewardRiskRatio.toFixed(2)}</p>
                    </div>
                    <PermissionBadge permission={setup.finalPermission} showHelp={false} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <Metric label="Entry" value={setup.plannedEntry} />
                    <Metric label="SL" value={setup.plannedStopLoss} />
                    <Metric label="Target" value={setup.plannedTarget1} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {setup.status === 'APPROVED' && (
                      <button className={buttonClass} type="button" onClick={() => startConfirmation(setup)}>
                        Confirm
                      </button>
                    )}
                    {setup.status === 'REJECTED' && (
                      <button
                        className={buttonClass}
                        disabled={busy}
                        type="button"
                        onClick={() => void onRetry(setup._id)}
                      >
                        Retry
                      </button>
                    )}
                    {['DRAFT', 'APPROVED', 'REJECTED'].includes(setup.status) && (
                      <button className={buttonClass} disabled={busy} type="button" onClick={() => void onCancel(setup._id)}>
                        Cancel
                      </button>
                    )}
                    {setup.status !== 'EXECUTED' && (
                      <button
                        className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 text-xs font-medium text-red-200 transition hover:bg-red-500/20"
                        disabled={busy}
                        type="button"
                        onClick={() => setDeleteId(setup._id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <DeleteConfirmDialog
        open={Boolean(deleteId)}
        title="Delete trade setup?"
        description="This is only allowed before actual trade confirmation. The backend will block the delete if an ActiveTrade already exists."
        busy={busy}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return
          void onDelete(deleteId).then(() => setDeleteId(null))
        }}
      />
    </Section>
  )
}

function SetupRow({
  setup,
  busy,
  confirming,
  draft,
  onDraft,
  onStartConfirmation,
  onCancelConfirmation,
  onConfirm,
  onCancel,
  onRetry,
  onDelete,
}: {
  setup: TradeSetup
  busy: boolean
  confirming: boolean
  draft: ConfirmationDraft
  onDraft: (draft: ConfirmationDraft) => void
  onStartConfirmation: (setup: TradeSetup) => void
  onCancelConfirmation: () => void
  onConfirm: (id: string, input: ConfirmActualTradeInput) => Promise<void>
  onCancel: (id: string) => Promise<void>
  onRetry: (id: string) => Promise<void>
  onDelete: (id: string) => void
}) {
  return (
    <>
      <tr className="border-b border-white/6 text-zinc-300 hover:bg-white/[0.02]">
        <td className="px-3 py-2 font-medium text-white">{setup.symbolSnapshot.displayName}</td>
        <td className="px-3 py-2">{setup.direction}</td>
        <td className="px-3 py-2">{setup.status}</td>
        <td className="px-3 py-2 font-mono">{setup.plannedEntry}</td>
        <td className="px-3 py-2 font-mono">{setup.plannedStopLoss}</td>
        <td className="px-3 py-2 font-mono">{setup.plannedTarget1}</td>
        <td className="px-3 py-2 font-mono">{setup.plannedRewardRiskRatio.toFixed(2)}</td>
        <td className="px-3 py-2"><PermissionBadge permission={setup.finalPermission} showHelp={false} /></td>
        <td className="px-3 py-2">
          <div className="flex justify-end gap-2">
            {setup.status === 'APPROVED' && !confirming && (
              <button className={buttonClass} type="button" onClick={() => onStartConfirmation(setup)}>
                Confirm
              </button>
            )}
            {setup.status === 'REJECTED' && (
              <button className={buttonClass} disabled={busy} type="button" onClick={() => void onRetry(setup._id)}>
                <RotateCcw className="h-4 w-4" />
                Retry
              </button>
            )}
            {['DRAFT', 'APPROVED', 'REJECTED'].includes(setup.status) && (
              <button className={buttonClass} disabled={busy} type="button" onClick={() => void onCancel(setup._id)}>
                <Ban className="h-4 w-4" />
                Cancel
              </button>
            )}
            {setup.status !== 'EXECUTED' && (
              <button
                className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 text-xs font-medium text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={busy}
                type="button"
                onClick={() => onDelete(setup._id)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            )}
          </div>
        </td>
      </tr>
      {confirming && (
        <tr className="border-b border-cyan-500/15 bg-cyan-500/5">
          <td colSpan={9} className="px-3 py-3">
            <div className="grid gap-2 md:grid-cols-6">
              {(
                [
                  ['actualEntry', 'Actual entry'],
                  ['actualQuantity', 'Qty'],
                  ['initialStopLoss', 'Initial SL'],
                  ['actualTarget1', 'Target 1'],
                  ['actualTarget2', 'Target 2'],
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
                  onChange={(event) => onDraft({ ...draft, [field]: event.target.value })}
                />
              ))}
              <div className="flex gap-2">
                <button
                  className={buttonClass}
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
                    }).then(onCancelConfirmation)
                  }
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Save
                </button>
                <button className={buttonClass} type="button" onClick={onCancelConfirmation}>Close</button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/6 bg-black/20 p-2">
      <span className="block text-[10px] uppercase text-zinc-600">{label}</span>
      <span className="font-mono text-zinc-300">{value}</span>
    </div>
  )
}
