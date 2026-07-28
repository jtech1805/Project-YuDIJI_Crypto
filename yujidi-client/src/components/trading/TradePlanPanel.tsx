import { Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type {
  CreateTradePlanInput,
  InstrumentType,
  MarketType,
  TradePlan,
  UpdateTradePlanInput,
} from '../../types/trade'
import { buttonClass, DeleteConfirmDialog, EmptyState, inputClass, Section } from './trading-ui'

const defaultForm: CreateTradePlanInput = {
  name: '',
  marketType: 'CRYPTO',
  tradeStyle: 'INTRADAY',
  instrumentType: 'SPOT',
  planMode: 'CONTINUOUS',
  startingCapital: 10000,
  currency: 'USD',
  maxRiskPerTradePercent: 1,
  maxDailyLossPercent: 3,
  maxConsecutiveLosses: 3,
  reviewCadence: 'WEEKLY',
}

export function TradePlanPanel({
  plans,
  selectedPlanId,
  busy,
  onSelect,
  onCreate,
  onActivate,
  onUpdate,
  onDelete,
}: {
  plans: TradePlan[]
  selectedPlanId: string
  busy: boolean
  onSelect: (id: string) => void
  onCreate: (input: CreateTradePlanInput) => Promise<void>
  onActivate: (id: string) => Promise<void>
  onUpdate: (id: string, input: UpdateTradePlanInput) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [editPlanId, setEditPlanId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<UpdateTradePlanInput>({})
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null)
  const [deletePhrase, setDeletePhrase] = useState('')
  const deletePlan = plans.find((plan) => plan._id === deletePlanId)
  const editPlan = plans.find((plan) => plan._id === editPlanId)

  return (
    <Section
      title="Trade Plans"
      action={
        <button className={buttonClass} type="button" onClick={() => setShowForm((open) => !open)}>
          <Plus className="h-4 w-4" />
          New plan
        </button>
      }
    >
      {showForm && (
        <form
          className="mb-4 grid gap-3 border border-white/8 bg-white/[0.02] p-4 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault()
            void onCreate(form).then(() => {
              setForm(defaultForm)
              setShowForm(false)
            })
          }}
        >
          <input
            required
            className={inputClass}
            placeholder="Plan name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <select
            className={inputClass}
            value={form.marketType}
            onChange={(event) => setForm({ ...form, marketType: event.target.value as MarketType })}
          >
            {['CRYPTO', 'EQUITY', 'FNO', 'COMMODITY', 'CURRENCY', 'INDEX'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select
            className={inputClass}
            value={form.instrumentType}
            onChange={(event) =>
              setForm({ ...form, instrumentType: event.target.value as InstrumentType })
            }
          >
            {['SPOT', 'CASH', 'FUTURE', 'OPTION', 'INDEX', 'UNKNOWN'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <input
            required
            className={inputClass}
            placeholder="Trade style"
            value={form.tradeStyle}
            onChange={(event) => setForm({ ...form, tradeStyle: event.target.value.toUpperCase() })}
          />
          <input
            required
            type="number"
            min="1"
            className={inputClass}
            placeholder="Starting capital"
            value={form.startingCapital}
            onChange={(event) => setForm({ ...form, startingCapital: Number(event.target.value) })}
          />
          <input
            required
            className={inputClass}
            placeholder="Currency"
            value={form.currency}
            onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })}
          />
          <input
            required
            type="number"
            min="0.1"
            max="10"
            step="0.1"
            className={inputClass}
            placeholder="Risk per trade %"
            value={form.maxRiskPerTradePercent}
            onChange={(event) =>
              setForm({ ...form, maxRiskPerTradePercent: Number(event.target.value) })
            }
          />
          <button disabled={busy} className={buttonClass} type="submit">
            Create draft
          </button>
        </form>
      )}

      {plans.length === 0 ? (
        <EmptyState>No trade plans yet</EmptyState>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan._id}
              className={`flex items-center gap-3 border p-3 ${
                selectedPlanId === plan._id
                  ? 'border-cyan-500/50 bg-cyan-500/5'
                  : 'border-white/8 bg-white/[0.02]'
              }`}
            >
              <button className="min-w-0 flex-1 text-left" type="button" onClick={() => onSelect(plan._id)}>
                <span className="block truncate text-sm font-medium text-white">{plan.name}</span>
                <span className="text-xs text-zinc-500">
                  {plan.marketType} · {plan.instrumentType} · {plan.tradeStyle} · {plan.status}
                </span>
              </button>
              {plan.status === 'DRAFT' && (
                <button
                  title="Activate trade plan"
                  className={buttonClass}
                  disabled={busy}
                  type="button"
                  onClick={() => void onActivate(plan._id)}
                >
                  <Play className="h-4 w-4" />
                  Activate
                </button>
              )}
              <button
                title="Edit trade plan"
                data-edit-plan-id={plan._id}
                className={buttonClass}
                disabled={busy}
                type="button"
                onClick={() => {
                  setEditPlanId(plan._id)
                  setEditForm({
                    name: plan.name,
                    description: plan.description ?? '',
                    maxTrades: plan.maxTrades,
                    reviewCadence: plan.reviewCadence,
                  })
                }}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                title="Delete trade plan"
                className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 text-xs font-medium text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={busy}
                type="button"
                onClick={() => {
                  setDeletePlanId(plan._id)
                  setDeletePhrase('')
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      {editPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <form
            className="w-full max-w-lg rounded-lg border border-white/10 bg-zinc-950 p-4 shadow-2xl"
            onSubmit={(event) => {
              event.preventDefault()
              if (!editPlanId) return
              void onUpdate(editPlanId, {
                name: editForm.name,
                description: editForm.description,
                maxTrades: editForm.maxTrades,
                reviewCadence: editForm.reviewCadence,
              }).then(() => {
                setEditPlanId(null)
                setEditForm({})
              })
            }}
          >
            <h3 className="text-sm font-semibold text-white">Edit trade plan</h3>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Active plans allow only capacity and label edits. Risk rules and starting capital stay locked.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-zinc-500">
                Name
                <input
                  required
                  className={`${inputClass} mt-1`}
                  value={editForm.name ?? ''}
                  onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                />
              </label>
              <label className="text-xs text-zinc-500">
                Max trades
                <input
                  className={`${inputClass} mt-1`}
                  min="1"
                  type="number"
                  value={editForm.maxTrades ?? ''}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      maxTrades: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                />
              </label>
              <label className="text-xs text-zinc-500">
                Review cadence
                <select
                  className={`${inputClass} mt-1`}
                  value={editForm.reviewCadence ?? ''}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      reviewCadence: event.target.value
                        ? (event.target.value as NonNullable<UpdateTradePlanInput['reviewCadence']>)
                        : undefined,
                    })
                  }
                >
                  <option value="">Not set</option>
                  {['DAILY', 'WEEKLY', 'MONTHLY', 'PLAN_END'].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-zinc-500 sm:col-span-2">
                Description
                <textarea
                  className={`${inputClass} mt-1 h-20 py-2`}
                  maxLength={1000}
                  value={editForm.description ?? ''}
                  onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className={buttonClass}
                disabled={busy}
                type="button"
                onClick={() => {
                  setEditPlanId(null)
                  setEditForm({})
                }}
              >
                Cancel
              </button>
              <button className={buttonClass} disabled={busy} type="submit">
                Save changes
              </button>
            </div>
          </form>
        </div>
      )}
      <DeleteConfirmDialog
        open={Boolean(deletePlan)}
        title="Delete trade plan?"
        description={`This will delete "${deletePlan?.name ?? 'this plan'}" only if it has no open trades or finalized history. Related draft score checks and pending setups may also be removed from the workflow.`}
        requireText="DELETE"
        confirmText={deletePhrase}
        busy={busy}
        onConfirmText={setDeletePhrase}
        onCancel={() => {
          setDeletePlanId(null)
          setDeletePhrase('')
        }}
        onConfirm={() => {
          if (!deletePlanId) return
          void onDelete(deletePlanId).then(() => {
            setDeletePlanId(null)
            setDeletePhrase('')
          })
        }}
      />
    </Section>
  )
}
