import { Play, Plus } from 'lucide-react'
import { useState } from 'react'
import type { CreateTradePlanInput, InstrumentType, MarketType, TradePlan } from '../../types/trade'
import { buttonClass, EmptyState, inputClass, Section } from './trading-ui'

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
}: {
  plans: TradePlan[]
  selectedPlanId: string
  busy: boolean
  onSelect: (id: string) => void
  onCreate: (input: CreateTradePlanInput) => Promise<void>
  onActivate: (id: string) => Promise<void>
}) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(defaultForm)

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
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}
