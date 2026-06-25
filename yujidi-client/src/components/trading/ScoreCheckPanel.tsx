import { Calculator, CornerDownRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { SymbolSearchResult } from '../../api/symbols'
import type {
  CreateScoreCheckInput,
  ScoreCheck,
  TradeDirection,
  TradePlan,
} from '../../types/trade'
import { SymbolPicker } from './SymbolPicker'
import { buttonClass, EmptyState, inputClass, PermissionBadge, Section } from './trading-ui'

type ScoreForm = {
  direction: TradeDirection
  entry: string
  stopLoss: string
  target1: string
  target2: string
  tradeStyle: string
  scoringTemplateKey: CreateScoreCheckInput['scoringTemplateKey']
}

const initialForm: ScoreForm = {
  direction: 'LONG',
  entry: '',
  stopLoss: '',
  target1: '',
  target2: '',
  tradeStyle: 'INTRADAY',
  scoringTemplateKey: 'CRYPTO_SPOT_INTRADAY_V1',
}

const templateOptions: Array<{
  value: CreateScoreCheckInput['scoringTemplateKey']
  label: string
}> = [
  { value: 'CRYPTO_SPOT_INTRADAY_V1', label: 'Crypto Spot Intraday — Baseline' },
  { value: 'CRYPTO_PERPETUAL_INTRADAY_V1', label: 'Crypto Perpetual Intraday — Baseline' },
  { value: 'INDIA_EQUITY_INTRADAY_V1', label: 'India Equity Intraday — Baseline' },
  { value: 'INDIA_EQUITY_SWING_V1', label: 'India Equity Swing — Baseline' },
  { value: 'COMMODITY_MCX_INTRADAY_V1', label: 'MCX Commodity Intraday — Baseline' },
]

function validateGeometry(form: ScoreForm): string | null {
  const entry = Number(form.entry)
  const stopLoss = Number(form.stopLoss)
  const target1 = Number(form.target1)
  if (!(entry > 0 && stopLoss > 0 && target1 > 0)) return 'Entry, stoploss and target must be positive'
  if (form.direction === 'LONG' && !(stopLoss < entry && entry < target1)) {
    return 'LONG requires stoploss < entry < target 1'
  }
  if (form.direction === 'SHORT' && !(target1 < entry && entry < stopLoss)) {
    return 'SHORT requires target 1 < entry < stoploss'
  }
  return null
}

function getConversionBlockReason(check: ScoreCheck, selectedPlan?: TradePlan): string | null {
  if (check.convertedToTradeSetupId) return 'This score check was already converted.'
  if (!['READY', 'READY_WITH_STALE_DATA'].includes(check.scoreStatus)) {
    return `Score status ${check.scoreStatus} is not ready for conversion.`
  }
  if (check.scoreValidUntil && new Date(check.scoreValidUntil).getTime() < Date.now()) {
    return 'This score check has expired. Run a new score check.'
  }
  if (!check.tradeScoreSnapshotId) return 'The score snapshot is missing. Run a new score check.'
  if (!selectedPlan) return 'Select an active compatible plan.'
  if (selectedPlan.status !== 'ACTIVE') return 'The selected plan must be ACTIVE.'
  if (
    selectedPlan.marketType !== check.marketType ||
    selectedPlan.instrumentType !== check.instrumentType ||
    selectedPlan.tradeStyle !== check.tradeStyle
  ) {
    return 'The selected plan does not match this score market, instrument, and trade style.'
  }
  return null
}

export function ScoreCheckPanel({
  scoreChecks,
  selectedPlan,
  busy,
  onCreate,
  onConvert,
}: {
  scoreChecks: ScoreCheck[]
  selectedPlan?: TradePlan
  busy: boolean
  onCreate: (input: CreateScoreCheckInput) => Promise<void>
  onConvert: (scoreCheckId: string, planId: string) => Promise<void>
}) {
  const [symbol, setSymbol] = useState<SymbolSearchResult | null>(null)
  const [form, setForm] = useState<ScoreForm>(initialForm)
  const [validationError, setValidationError] = useState<string | null>(null)
  const recentChecks = useMemo(() => scoreChecks.slice(0, 5), [scoreChecks])

  const submit = async () => {
    const error = validateGeometry(form)
    if (!symbol) {
      setValidationError('Select a symbol')
      return
    }
    if (error) {
      setValidationError(error)
      return
    }
    setValidationError(null)
    await onCreate({
      symbolId: symbol.symbolId,
      marketType: symbol.marketType as CreateScoreCheckInput['marketType'],
      instrumentType: (symbol.instrumentType ?? 'UNKNOWN') as CreateScoreCheckInput['instrumentType'],
      tradeStyle: form.tradeStyle,
      direction: form.direction,
      entry: Number(form.entry),
      stopLoss: Number(form.stopLoss),
      target1: Number(form.target1),
      ...(Number(form.target2) > 0 ? { target2: Number(form.target2) } : {}),
      scoringTemplateKey: form.scoringTemplateKey,
      scoringTemplateVersion: '1.0.0',
      dataConfidence: 'MEDIUM',
    })
  }

  return (
    <Section title="Score Check">
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-3 border border-white/8 bg-white/[0.02] p-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <SymbolPicker
              value={symbol}
              onChange={(nextSymbol) => {
                setSymbol(nextSymbol)
                if (nextSymbol) {
                  const crypto = nextSymbol.marketType === 'CRYPTO'
                  const mcxCommodity =
                    nextSymbol.marketType === 'COMMODITY' &&
                    nextSymbol.exchange === 'MCX' &&
                    nextSymbol.instrumentType === 'FUTURE'
                  setForm((current) => ({
                    ...current,
                    tradeStyle: selectedPlan?.tradeStyle ?? current.tradeStyle,
                    scoringTemplateKey: mcxCommodity
                      ? 'COMMODITY_MCX_INTRADAY_V1'
                      : crypto
                        ? 'CRYPTO_SPOT_INTRADAY_V1'
                        : 'INDIA_EQUITY_INTRADAY_V1',
                  }))
                }
              }}
            />
          </div>
          {symbol && (symbol.exchange === 'MCX' || symbol.marketType === 'COMMODITY') && (
            <div className="border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-xs leading-5 text-amber-200 md:col-span-2">
              {form.scoringTemplateKey === 'COMMODITY_MCX_INTRADAY_V1'
                ? 'MCX baseline scoring is available. It uses risk/reward and contract sanity checks. Advanced commodity context is not yet included.'
                : 'This template may not fully match the selected commodity instrument.'}
            </div>
          )}
          <select
            className={inputClass}
            value={form.direction}
            onChange={(event) => setForm({ ...form, direction: event.target.value as TradeDirection })}
          >
            <option>LONG</option>
            <option>SHORT</option>
          </select>
          <input
            className={inputClass}
            value={form.tradeStyle}
            onChange={(event) => setForm({ ...form, tradeStyle: event.target.value.toUpperCase() })}
            placeholder="Trade style"
          />
          {(['entry', 'stopLoss', 'target1', 'target2'] as const).map((field) => (
            <input
              key={field}
              type="number"
              min="0"
              step="any"
              className={inputClass}
              value={form[field]}
              placeholder={{
                entry: 'Entry',
                stopLoss: 'Stoploss',
                target1: 'Target 1',
                target2: 'Target 2 (optional)',
              }[field]}
              onChange={(event) => setForm({ ...form, [field]: event.target.value })}
            />
          ))}
          <select
            className={`${inputClass} md:col-span-2`}
            value={form.scoringTemplateKey}
            onChange={(event) =>
              setForm({
                ...form,
                scoringTemplateKey: event.target.value as ScoreForm['scoringTemplateKey'],
              })
            }
          >
            {templateOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {validationError && <p className="text-xs text-red-300 md:col-span-2">{validationError}</p>}
          <button
            className={`${buttonClass} md:col-span-2`}
            disabled={busy}
            type="button"
            onClick={() => void submit()}
          >
            <Calculator className="h-4 w-4" />
            Run score check
          </button>
        </div>

        <div className="space-y-2">
          {recentChecks.length === 0 ? (
            <EmptyState>No score checks yet</EmptyState>
          ) : (
            recentChecks.map((check) => {
              const blockReason = getConversionBlockReason(check, selectedPlan)
              return (
                <div key={check._id} className="border border-white/8 bg-white/[0.02] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {check.symbolSnapshot?.displayName ?? 'Unknown symbol'} · {check.direction}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Score {check.score ?? '—'} · R:R{' '}
                        {typeof check.rewardRiskRatio === 'number'
                          ? check.rewardRiskRatio.toFixed(2)
                          : '—'}
                      </p>
                    </div>
                    <PermissionBadge permission={check.permission} />
                  </div>
                  {(check.warnings?.length ?? 0) > 0 && (
                    <p className="mt-2 text-xs text-amber-300">{check.warnings?.[0]}</p>
                  )}
                  {blockReason && !check.convertedToTradeSetupId && (
                    <p className="mt-2 text-xs leading-4 text-zinc-500">{blockReason}</p>
                  )}
                  {!check.convertedToTradeSetupId && (
                    <button
                      className={`${buttonClass} mt-3 w-full`}
                      disabled={busy || Boolean(blockReason)}
                      title={blockReason ?? 'Convert to governed setup'}
                      type="button"
                      onClick={() =>
                        selectedPlan && void onConvert(check._id, selectedPlan._id)
                      }
                    >
                      <CornerDownRight className="h-4 w-4" />
                      Convert to trade setup
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </Section>
  )
}
