import {
  Archive,
  Calculator,
  CornerDownRight,
  Eye,
  FilePenLine,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react'
import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { getScoreCheckSnapshot } from '../../api/scoreChecks'
import type { SymbolSearchResult } from '../../api/symbols'
import type {
  CreateScoreCheckInput,
  ScoreCheckSnapshot,
  ScoringTemplateSummary,
  ScoreCheck,
  TradeDirection,
  TradePermission,
  TradePlan,
  TradeSetup,
} from '../../types/trade'
import { SymbolPicker } from './SymbolPicker'
import {
  buttonClass,
  DeleteConfirmDialog,
  EmptyState,
  inputClass,
  panelClass,
  PermissionBadge,
  Section,
} from './trading-ui'

type ScoreForm = {
  direction: TradeDirection
  entry: string
  stopLoss: string
  target1: string
  target2: string
  tradeStyle: string
  scoringTemplateSelection: string
}

const initialForm: ScoreForm = {
  direction: 'LONG',
  entry: '',
  stopLoss: '',
  target1: '',
  target2: '',
  tradeStyle: 'INTRADAY',
  scoringTemplateSelection: 'system:CRYPTO_SPOT_INTRADAY_V1',
}

const staticTemplateOptions: Array<{
  value: string
  label: string
}> = [
  { value: 'CRYPTO_SPOT_INTRADAY_V1', label: 'Crypto Spot Intraday' },
  { value: 'CRYPTO_PERPETUAL_INTRADAY_V1', label: 'Crypto Perpetual Intraday' },
  { value: 'INDIA_EQUITY_INTRADAY_V1', label: 'India Equity Intraday' },
  { value: 'INDIA_EQUITY_SWING_V1', label: 'India Equity Swing' },
  { value: 'INDIA_FNO_FUTURE_INTRADAY_V1', label: 'India F&O Future Intraday' },
  { value: 'INDIA_FNO_OPTION_INTRADAY_V1', label: 'India F&O Option Intraday' },
  { value: 'COMMODITY_MCX_INTRADAY_V1', label: 'MCX Commodity Intraday' },
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
  if (check.convertedToTradeSetupId) return 'Already converted'
  if (!['READY', 'READY_WITH_STALE_DATA', 'PARTIAL_DATA'].includes(check.scoreStatus)) {
    return `Status ${check.scoreStatus} cannot convert`
  }
  if (check.scoreValidUntil && new Date(check.scoreValidUntil).getTime() < Date.now()) {
    return 'Expired score'
  }
  if (!selectedPlan) return 'Select compatible plan'
  if (selectedPlan.status !== 'ACTIVE') return 'Plan must be ACTIVE'
  if (
    selectedPlan.marketType !== check.marketType ||
    selectedPlan.instrumentType !== check.instrumentType ||
    selectedPlan.tradeStyle !== check.tradeStyle
  ) {
    return 'Plan scope mismatch'
  }
  return null
}

function getLinkedSetup(check: ScoreCheck, setups: TradeSetup[]): TradeSetup | undefined {
  if (!check.convertedToTradeSetupId) return undefined
  return setups.find((setup) => setup._id === check.convertedToTradeSetupId)
}

function canRetryLinkedSetup(setup?: TradeSetup): boolean {
  return setup?.status === 'REJECTED'
}

function scoreTone(permission: TradePermission): string {
  if (permission === 'TAKE_TRADE') return 'border-emerald-500/30 bg-emerald-500/8'
  if (permission === 'TAKE_SMALL_RISK') return 'border-amber-500/30 bg-amber-500/8'
  if (permission === 'WAIT') return 'border-sky-500/30 bg-sky-500/8'
  return 'border-red-500/35 bg-red-500/8'
}

function riskRewardPreview(form: ScoreForm): {
  risk: number
  reward: number
  rr: number
} | null {
  const entry = Number(form.entry)
  const stopLoss = Number(form.stopLoss)
  const target1 = Number(form.target1)
  if (!(entry > 0 && stopLoss > 0 && target1 > 0)) return null
  const risk = form.direction === 'LONG' ? entry - stopLoss : stopLoss - entry
  const reward = form.direction === 'LONG' ? target1 - entry : entry - target1
  if (!(risk > 0 && reward > 0)) return null
  return { risk, reward, rr: reward / risk }
}

function formatExpiryDistance(expiresAt?: string): string {
  if (!expiresAt) return 'No expiry'
  const remainingMs = new Date(expiresAt).getTime() - Date.now()
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 'Expired'
  const hours = Math.floor(remainingMs / (60 * 60 * 1000))
  const minutes = Math.round((remainingMs % (60 * 60 * 1000)) / (60 * 1000))
  if (hours >= 24) return `Expires in ${Math.round(hours / 24)}d`
  if (hours > 0) return `Expires in ${hours}h ${minutes}m`
  return `Expires in ${minutes}m`
}

function formatAge(ageMs?: number): string {
  if (ageMs === undefined) return '—'
  if (ageMs < 60_000) return `${Math.round(ageMs / 1000)}s`
  return `${Math.round(ageMs / 60_000)}m`
}

export function ScoreCheckPanel({
  scoreChecks,
  setups,
  scoringTemplates,
  selectedPlan,
  requestedTemplateSelection,
  busy,
  onCreate,
  onConvert,
  onRetryRejectedSetup,
  onDelete,
  onTemplateSelectionConsumed,
}: {
  scoreChecks: ScoreCheck[]
  setups: TradeSetup[]
  scoringTemplates: ScoringTemplateSummary[]
  selectedPlan?: TradePlan
  requestedTemplateSelection?: string
  busy: boolean
  onCreate: (input: CreateScoreCheckInput) => Promise<void>
  onConvert: (scoreCheckId: string, planId: string) => Promise<void>
  onRetryRejectedSetup: (tradeSetupId: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onTemplateSelectionConsumed?: () => void
}) {
  const [symbol, setSymbol] = useState<SymbolSearchResult | null>(null)
  const [form, setForm] = useState<ScoreForm>(initialForm)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [query, setQuery] = useState('')
  const [directionFilter, setDirectionFilter] = useState<'ALL' | TradeDirection>('ALL')
  const [permissionFilter, setPermissionFilter] = useState<'ALL' | TradePermission>('ALL')
  const [archivedIds, setArchivedIds] = useState<string[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const visibleChecks = scoreChecks
  const latestCheck = visibleChecks[0]
  const templateOptions = useMemo(() => {
    const fallback = staticTemplateOptions.map((option) => ({
      value: `system:${option.value}`,
      label: option.label,
      marketType: undefined as ScoringTemplateSummary['marketType'] | undefined,
      tradeStyle: undefined as string | undefined,
      instrumentType: undefined as ScoringTemplateSummary['instrumentType'] | undefined,
    }))
    const apiTemplates = scoringTemplates.map((template) => ({
      value: template.scope === 'USER' && template.id ? `user:${template.id}` : `system:${template.templateKey}`,
      label: `${template.templateName} · v${template.version}${template.scope === 'USER' ? ' · Custom' : ''}`,
      marketType: template.marketType,
      tradeStyle: template.tradeStyle,
      instrumentType: template.instrumentType,
    }))
    return apiTemplates.length > 0 ? apiTemplates : fallback
  }, [scoringTemplates])
  const selectedTemplate = useMemo(() => {
    if (!form.scoringTemplateSelection.startsWith('user:')) return undefined
    const templateId = form.scoringTemplateSelection.replace('user:', '')
    return scoringTemplates.find((template) => template.id === templateId)
  }, [form.scoringTemplateSelection, scoringTemplates])
  const allowedSymbolIds = selectedTemplate?.allowedTradableSymbols ?? []
  const templateRestrictsSymbols = selectedTemplate?.scope === 'USER'
  const templateHasAllowedSymbols = templateRestrictsSymbols && allowedSymbolIds.length > 0
  const templateSymbolHelper = templateHasAllowedSymbols
    ? 'This template only allows symbols configured inside it.'
    : templateRestrictsSymbols
      ? 'This custom template has no allowed symbols configured.'
      : undefined
  useEffect(() => {
    if (!symbol || !templateHasAllowedSymbols) return
    if (!allowedSymbolIds.includes(symbol.symbolId)) {
      setSymbol(null)
      setValidationError('This template only allows symbols configured inside it.')
    }
  }, [allowedSymbolIds, symbol, templateHasAllowedSymbols])
  const latestLinkedSetup = latestCheck ? getLinkedSetup(latestCheck, setups) : undefined
  const history = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return visibleChecks
      .filter((check) => !archivedIds.includes(check._id))
      .filter((check) => directionFilter === 'ALL' || check.direction === directionFilter)
      .filter((check) => permissionFilter === 'ALL' || check.permission === permissionFilter)
      .filter((check) => {
        if (!normalizedQuery) return true
        return [
          check.symbolSnapshot?.displayName,
          check.symbolSnapshot?.symbol,
          check.permission,
          check.reasonCodes?.join(' '),
        ].some((value) => value?.toLowerCase().includes(normalizedQuery))
      })
      .slice(0, 20)
  }, [archivedIds, directionFilter, permissionFilter, query, visibleChecks])
  const preview = riskRewardPreview(form)

  useEffect(() => {
    if (!requestedTemplateSelection) return
    setForm((current) => ({
      ...current,
      scoringTemplateSelection: requestedTemplateSelection,
    }))
    setSymbol(null)
    setValidationError('Template selected. Choose one of its allowed symbols to run the score check.')
    onTemplateSelectionConsumed?.()
  }, [onTemplateSelectionConsumed, requestedTemplateSelection])

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
    setScanning(true)
    try {
      const templatePayload = form.scoringTemplateSelection.startsWith('user:')
        ? { scoringTemplateId: form.scoringTemplateSelection.replace('user:', '') }
        : { scoringTemplateKey: form.scoringTemplateSelection.replace('system:', '') }
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
        ...templatePayload,
        scoringTemplateVersion: '1.0.0',
        dataConfidence: 'MEDIUM',
      })
    } finally {
      setScanning(false)
    }
  }

  return (
    <Section title="Score Check">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <div className={`${panelClass} p-3`}>
          <div className="grid gap-2 md:grid-cols-4">
            <div className="md:col-span-4">
              <SymbolPicker
                value={symbol}
                allowedSymbolIds={templateHasAllowedSymbols ? allowedSymbolIds : undefined}
                helperText={templateSymbolHelper}
                onChange={(nextSymbol) => {
                  setSymbol(nextSymbol)
                  if (nextSymbol) {
                    const crypto = nextSymbol.marketType === 'CRYPTO'
                    const mcxCommodity =
                      nextSymbol.marketType === 'COMMODITY' &&
                      nextSymbol.exchange === 'MCX' &&
                      nextSymbol.instrumentType === 'FUTURE'
                    const indiaFuture = nextSymbol.marketType === 'FNO' && nextSymbol.instrumentType === 'FUTURE'
                    const indiaOption = nextSymbol.marketType === 'FNO' && nextSymbol.instrumentType === 'OPTION'
                    setForm((current) => ({
                      ...current,
                      tradeStyle: selectedPlan?.tradeStyle ?? current.tradeStyle,
                      scoringTemplateSelection: current.scoringTemplateSelection.startsWith('user:')
                        ? current.scoringTemplateSelection
                        : mcxCommodity
                        ? 'system:COMMODITY_MCX_INTRADAY_V1'
                        : crypto
                          ? 'system:CRYPTO_SPOT_INTRADAY_V1'
                          : indiaFuture
                            ? 'system:INDIA_FNO_FUTURE_INTRADAY_V1'
                            : indiaOption
                              ? 'system:INDIA_FNO_OPTION_INTRADAY_V1'
                              : 'system:INDIA_EQUITY_INTRADAY_V1',
                    }))
                  }
                }}
              />
            </div>
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
              placeholder="Style"
            />
            <select
              className="h-9 w-full rounded-md border border-white/10 bg-black/30 px-2.5 text-xs text-white outline-none transition focus:border-cyan-500/60 md:col-span-2"
              value={form.scoringTemplateSelection}
              onChange={(event) =>
                setForm({
                  ...form,
                  scoringTemplateSelection: event.target.value,
                })
              }
            >
              {templateOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
                  stopLoss: 'Stop',
                  target1: 'Target 1',
                  target2: 'Target 2',
                }[field]}
                onChange={(event) => setForm({ ...form, [field]: event.target.value })}
              />
            ))}
            <div className="flex items-center justify-between rounded-md border border-white/8 bg-black/20 px-3 py-2 text-xs text-zinc-400 md:col-span-3">
              {preview ? (
                <>
                  <span>Risk <b className="font-mono text-red-200">{preview.risk.toFixed(2)}</b></span>
                  <span>Reward <b className="font-mono text-emerald-200">{preview.reward.toFixed(2)}</b></span>
                  <span>R:R <b className="font-mono text-white">{preview.rr.toFixed(2)}</b></span>
                </>
              ) : (
                <span>Enter valid geometry to preview risk/reward</span>
              )}
            </div>
            <button
              className={`${buttonClass} h-9 md:col-span-1`}
              disabled={busy || scanning}
              type="button"
              onClick={() => void submit()}
            >
              <Calculator className="h-4 w-4" />
              Run
            </button>
            {validationError && <p className="text-xs text-red-300 md:col-span-4">{validationError}</p>}
          </div>
          {scanning && <ScoreScanLoader template={form.scoringTemplateSelection.replace(/^(system|user):/, '')} />}
        </div>

        <LatestScoreCard
          check={latestCheck}
          linkedSetup={latestLinkedSetup}
          selectedPlan={selectedPlan}
          busy={busy}
          note={latestCheck ? notes[latestCheck._id] : undefined}
          onNote={(id, value) => setNotes((current) => ({ ...current, [id]: value }))}
          onArchive={(id) => setArchivedIds((current) => [...new Set([...current, id])])}
          onDelete={setDeleteId}
          onConvert={onConvert}
          onRetryRejectedSetup={onRetryRejectedSetup}
        />
      </div>

      <ScoreHistoryTable
        checks={history}
        archivedCount={archivedIds.length}
        busy={busy}
        query={query}
        directionFilter={directionFilter}
        permissionFilter={permissionFilter}
        expandedId={expandedId}
        notes={notes}
        selectedPlan={selectedPlan}
        setups={setups}
        onQuery={setQuery}
        onDirectionFilter={setDirectionFilter}
        onPermissionFilter={setPermissionFilter}
        onToggleExpand={(id) => setExpandedId((current) => (current === id ? null : id))}
        onNote={(id, value) => setNotes((current) => ({ ...current, [id]: value }))}
        onArchive={(id) => setArchivedIds((current) => [...new Set([...current, id])])}
        onDelete={setDeleteId}
        onConvert={onConvert}
        onRetryRejectedSetup={onRetryRejectedSetup}
      />
      <DeleteConfirmDialog
        open={Boolean(deleteId)}
        title="Delete score check?"
        description="This will delete the score check in the backend and mark its score snapshot deleted. If it has a pending non-executed setup, that setup may also be removed."
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

function LatestScoreCard({
  check,
  linkedSetup,
  selectedPlan,
  busy,
  note,
  onNote,
  onArchive,
  onDelete,
  onConvert,
  onRetryRejectedSetup,
}: {
  check?: ScoreCheck
  linkedSetup?: TradeSetup
  selectedPlan?: TradePlan
  busy: boolean
  note?: string
  onNote: (id: string, value: string) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
  onConvert: (scoreCheckId: string, planId: string) => Promise<void>
  onRetryRejectedSetup: (tradeSetupId: string) => Promise<void>
}) {
  const [snapshot, setSnapshot] = useState<ScoreCheckSnapshot | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)

  useEffect(() => {
    if (!check?.scoreCheckSnapshotId) {
      setSnapshot(null)
      setSnapshotError(null)
      return
    }
    let mounted = true
    setSnapshotLoading(true)
    setSnapshotError(null)
    getScoreCheckSnapshot(check._id)
      .then((nextSnapshot) => {
        if (!mounted) return
        setSnapshot(nextSnapshot)
      })
      .catch((error: unknown) => {
        if (!mounted) return
        setSnapshot(null)
        setSnapshotError(error instanceof Error ? error.message : 'Snapshot is unavailable')
      })
      .finally(() => {
        if (mounted) setSnapshotLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [check?._id, check?.scoreCheckSnapshotId])

  if (!check) {
    return (
      <div className={`${panelClass} flex min-h-52 items-center justify-center p-4`}>
        <EmptyState>Latest score result will appear here</EmptyState>
      </div>
    )
  }
  const blockReason = getConversionBlockReason(check, selectedPlan)
  const retryable = canRetryLinkedSetup(linkedSetup)
  const displayBlockReason = retryable ? 'Converted to rejected setup' : blockReason
  return (
    <div className={`${panelClass} ${scoreTone(check.permission)} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Latest score</p>
          <h3 className="mt-1 text-base font-semibold text-white">
            {check.symbolSnapshot?.displayName ?? 'Unknown symbol'} · {check.direction}
          </h3>
          <p className="mt-1 text-xs text-zinc-400">
            {new Date(check.createdAt).toLocaleString()} · {check.scoreStatus}
          </p>
          {check.scoreCheckSnapshotId && (
            <p className="mt-1 text-[11px] text-zinc-500">
              Snapshot {check.scoreCheckSnapshotId.slice(-8)}
              {check.scoreCheckSnapshotCreatedAt ? ` · created ${new Date(check.scoreCheckSnapshotCreatedAt).toLocaleTimeString()}` : ''}
              {check.scoreCheckSnapshotExpiresAt ? ` · expires ${new Date(check.scoreCheckSnapshotExpiresAt).toLocaleString()}` : ''}
            </p>
          )}
          {linkedSetup?.tradeScoreSnapshotId && (
            <p className="mt-1 text-[11px] text-emerald-300">
              Permanent score snapshot saved
            </p>
          )}
        </div>
        <PermissionBadge permission={check.permission} showHelp={false} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric label="Score" value={check.score ?? '—'} strong />
        <Metric label="R:R" value={check.rewardRiskRatio?.toFixed(2) ?? '—'} />
        <Metric label="Risk" value={check.scoreStatus.replaceAll('_', ' ')} />
      </div>
      <p className="mt-3 line-clamp-2 text-xs text-amber-200">
        {check.reasonCodes?.[0] ?? check.warnings?.[0] ?? 'No blocking reason reported'}
      </p>
      <ScoreExplanationPanel
        check={check}
        snapshot={snapshot}
        loading={snapshotLoading}
        error={snapshotError}
      />
      <input
        className={`${inputClass} mt-3`}
        placeholder="Local note / tag"
        value={note ?? ''}
        onChange={(event) => onNote(check._id, event.target.value)}
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        {retryable && linkedSetup ? (
          <button
            className={buttonClass}
            disabled={busy}
            title="Retry rejected governed setup"
            type="button"
            onClick={() => void onRetryRejectedSetup(linkedSetup._id)}
          >
            <RotateCcw className="h-4 w-4" />
            Retry rejected setup
          </button>
        ) : (
          <button
            className={buttonClass}
            disabled={busy || Boolean(blockReason)}
            title={blockReason ?? 'Convert to governed setup'}
            type="button"
            onClick={() => selectedPlan && void onConvert(check._id, selectedPlan._id)}
          >
            <CornerDownRight className="h-4 w-4" />
            Convert
          </button>
        )}
        <button className={buttonClass} type="button" onClick={() => onArchive(check._id)}>
          <Archive className="h-4 w-4" />
          Archive
        </button>
        <button className={buttonClass} type="button">
          <FilePenLine className="h-4 w-4" />
          Edit note
        </button>
        <button
          className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 text-xs font-medium text-red-200 transition hover:bg-red-500/20"
          type="button"
          onClick={() => onDelete(check._id)}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
      {displayBlockReason && <p className="mt-2 text-[11px] text-zinc-500">{displayBlockReason}</p>}
    </div>
  )
}

function ScoreExplanationPanel({
  check,
  snapshot,
  loading,
  error,
}: {
  check: ScoreCheck
  snapshot: ScoreCheckSnapshot | null
  loading: boolean
  error: string | null
}) {
  const readiness = snapshot?.resourceReadinessSummary ?? check.resourceSnapshotSummary?.resourceReadinessSummary
  const resources = snapshot?.resourceSnapshots ?? check.resourceSnapshotSummary?.resourceSnapshots ?? []
  const warnings = snapshot?.warnings ?? check.resourceSnapshotSummary?.warnings ?? check.warnings ?? []
  const blockers = snapshot?.blockers ?? check.resourceSnapshotSummary?.blockers ?? []
  const sectionBreakdown = snapshot?.sectionBreakdown ?? []
  const selectedSymbol = snapshot?.selectedSymbol
  const latestPrimary = resources.find((resource) => resource.role === 'PRIMARY_SYMBOL')

  return (
    <div className="mt-3 rounded-md border border-white/8 bg-black/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase text-zinc-400">Score Explanation</p>
          <p className="mt-1 text-xs text-zinc-500">
            {snapshot
              ? `${snapshot.scoringTemplateName} · v${snapshot.scoringTemplateVersion} · ${snapshot.scoringTemplateScope}`
              : `${check.scoringTemplateName ?? check.scoringTemplateKey ?? 'Template'} · ${check.scoringTemplateScope ?? 'SYSTEM'}`}
          </p>
        </div>
        <span className="text-[11px] text-zinc-500">
          {snapshot?.expiresAt
            ? `${formatExpiryDistance(snapshot.expiresAt)} · ${new Date(snapshot.expiresAt).toLocaleString()}`
            : check.scoreCheckSnapshotExpiresAt
              ? formatExpiryDistance(check.scoreCheckSnapshotExpiresAt)
              : loading
                ? 'Loading snapshot'
                : 'Snapshot pending'}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Metric label="Final Score" value={snapshot?.finalScore ?? check.score ?? '—'} strong />
        <Metric label="Permission" value={snapshot?.permission ?? check.permission} />
        <Metric label="Confidence" value={snapshot?.dataConfidence ?? '—'} />
        <Metric label="Status" value={snapshot?.scoreStatus ?? check.scoreStatus} />
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="rounded border border-white/8 p-2">
          <p className="text-[10px] uppercase text-zinc-600">Selected Symbol</p>
          <p className="mt-1 truncate text-xs font-semibold text-white">
            {selectedSymbol?.symbol ?? check.symbolSnapshot?.displayName ?? check.symbolSnapshot?.symbol ?? '—'}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            {(selectedSymbol?.exchange ?? check.symbolSnapshot?.exchange ?? '—')} · {(selectedSymbol?.instrumentType ?? check.symbolSnapshot?.instrumentType ?? '—')}
            {latestPrimary?.price !== undefined ? ` · LTP ${latestPrimary.price}` : ''}
          </p>
        </div>
        <div className="rounded border border-white/8 p-2">
          <p className="text-[10px] uppercase text-zinc-600">Resource Readiness</p>
          <p className="mt-1 text-xs text-white">
            {readiness ? `${readiness.ready}/${readiness.total} ready` : 'No resources captured'}
          </p>
          {readiness && (
            <p className="mt-1 text-[11px] text-zinc-500">
              stale {readiness.stale} · partial {readiness.partial} · missing {readiness.missing} · blocking {readiness.blockingMissing}
            </p>
          )}
        </div>
      </div>

      {resources.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase text-zinc-500">Resources</p>
          <div className="grid gap-1 md:grid-cols-2">
            {resources.slice(0, 8).map((resource) => (
              <div key={`${resource.role}:${resource.symbolId}`} className="rounded border border-white/8 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] text-zinc-500">{resource.role.replaceAll('_', ' ')}</span>
                  <span className="text-[11px] text-zinc-300">{resource.freshnessStatus}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-zinc-100">{resource.symbol}</span>
                  <span className="text-zinc-400">{resource.price ?? '—'}</span>
                </div>
                <p className="mt-0.5 text-[10px] text-zinc-600">
                  change {resource.changePercent ?? '—'} · vwap {resource.vwapPosition ?? '—'} · age {formatAge(resource.ageMs)}
                </p>
                {resource.warnings.length > 0 && (
                  <p className="mt-0.5 truncate text-[10px] text-amber-300">{resource.warnings[0]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {sectionBreakdown.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase text-zinc-500">Section Breakdown</p>
          <div className="grid gap-1 md:grid-cols-2">
            {sectionBreakdown.slice(0, 8).map((section) => (
              <div key={section.sectionKey} className="rounded border border-white/8 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-zinc-100">{section.label ?? section.sectionKey}</span>
                  <span className="font-mono text-xs text-white">{section.score ?? '—'}/{section.maxScore ?? '—'}</span>
                </div>
                <p className="mt-0.5 text-[10px] text-zinc-600">
                  {section.status ?? '—'} · weight {section.weight ?? '—'}
                </p>
                {(section.reasonCodes?.length || section.warnings?.length) && (
                  <p className="mt-0.5 truncate text-[10px] text-amber-300">
                    {section.reasonCodes?.[0] ?? section.warnings?.[0]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {(warnings.length > 0 || blockers.length > 0 || error) && (
        <div className="mt-3 space-y-1 text-[11px]">
          {blockers.slice(0, 4).map((blocker) => <p key={blocker} className="text-red-300">{blocker}</p>)}
          {warnings.slice(0, 4).map((warning) => <p key={warning} className="text-amber-300">{warning}</p>)}
          {error && <p className="text-zinc-500">{error}</p>}
        </div>
      )}

      {(snapshot?._id || check.scoreCheckSnapshotId) && (
        <p className="mt-3 text-[10px] text-zinc-600">
          Snapshot id {(snapshot?._id ?? check.scoreCheckSnapshotId)?.slice(-8)}
          {snapshot?.createdAt ? ` · created ${new Date(snapshot.createdAt).toLocaleString()}` : ''}
        </p>
      )}
    </div>
  )
}

function ScoreHistoryTable({
  checks,
  archivedCount,
  busy,
  query,
  directionFilter,
  permissionFilter,
  expandedId,
  notes,
  selectedPlan,
  setups,
  onQuery,
  onDirectionFilter,
  onPermissionFilter,
  onToggleExpand,
  onNote,
  onArchive,
  onDelete,
  onConvert,
  onRetryRejectedSetup,
}: {
  checks: ScoreCheck[]
  archivedCount: number
  busy: boolean
  query: string
  directionFilter: 'ALL' | TradeDirection
  permissionFilter: 'ALL' | TradePermission
  expandedId: string | null
  notes: Record<string, string>
  selectedPlan?: TradePlan
  setups: TradeSetup[]
  onQuery: (value: string) => void
  onDirectionFilter: (value: 'ALL' | TradeDirection) => void
  onPermissionFilter: (value: 'ALL' | TradePermission) => void
  onToggleExpand: (id: string) => void
  onNote: (id: string, value: string) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
  onConvert: (scoreCheckId: string, planId: string) => Promise<void>
  onRetryRejectedSetup: (tradeSetupId: string) => Promise<void>
}) {
  return (
    <div className={`${panelClass} mt-4 overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-white/8 p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-600" />
          <input
            className={`${inputClass} pl-8`}
            placeholder="Search history"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
          />
        </div>
        <select
          className="h-9 rounded-md border border-white/10 bg-black/30 px-2.5 text-xs text-white"
          value={directionFilter}
          onChange={(event) => onDirectionFilter(event.target.value as 'ALL' | TradeDirection)}
        >
          <option>ALL</option>
          <option>LONG</option>
          <option>SHORT</option>
        </select>
        <select
          className="h-9 rounded-md border border-white/10 bg-black/30 px-2.5 text-xs text-white"
          value={permissionFilter}
          onChange={(event) => onPermissionFilter(event.target.value as 'ALL' | TradePermission)}
        >
          <option>ALL</option>
          <option>TAKE_TRADE</option>
          <option>TAKE_SMALL_RISK</option>
          <option>WAIT</option>
          <option>REJECT</option>
          <option>STOP_TRADING</option>
        </select>
        <span className="text-[11px] text-zinc-600">Showing {checks.length} · archived {archivedCount}</span>
      </div>
      {checks.length === 0 ? (
        <div className="p-4">
          <EmptyState>No matching score history</EmptyState>
        </div>
      ) : (
        <div className="max-h-[22rem] overflow-auto">
          <table className="hidden min-w-full text-left text-xs lg:table">
            <thead className="sticky top-0 bg-zinc-950 text-[10px] uppercase text-zinc-600">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Symbol</th>
                <th className="px-3 py-2">Dir</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">R:R</th>
                <th className="px-3 py-2">Decision</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((check) => (
                <ScoreHistoryRow
                  key={check._id}
                  check={check}
                  linkedSetup={getLinkedSetup(check, setups)}
                  busy={busy}
                  expanded={expandedId === check._id}
                  note={notes[check._id]}
                  selectedPlan={selectedPlan}
                  onToggleExpand={onToggleExpand}
                  onNote={onNote}
                  onArchive={onArchive}
                  onDelete={onDelete}
                  onConvert={onConvert}
                  onRetryRejectedSetup={onRetryRejectedSetup}
                />
              ))}
            </tbody>
          </table>
          <div className="grid gap-2 p-3 lg:hidden">
            {checks.map((check) => (
              <MobileScoreCard
                key={check._id}
                check={check}
                busy={busy}
                selectedPlan={selectedPlan}
                linkedSetup={getLinkedSetup(check, setups)}
                onArchive={onArchive}
                onDelete={onDelete}
                onConvert={onConvert}
                onRetryRejectedSetup={onRetryRejectedSetup}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ScoreHistoryRow({
  check,
  linkedSetup,
  busy,
  expanded,
  note,
  selectedPlan,
  onToggleExpand,
  onNote,
  onArchive,
  onDelete,
  onConvert,
  onRetryRejectedSetup,
}: {
  check: ScoreCheck
  linkedSetup?: TradeSetup
  busy: boolean
  expanded: boolean
  note?: string
  selectedPlan?: TradePlan
  onToggleExpand: (id: string) => void
  onNote: (id: string, value: string) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
  onConvert: (scoreCheckId: string, planId: string) => Promise<void>
  onRetryRejectedSetup: (tradeSetupId: string) => Promise<void>
}) {
  const blockReason = getConversionBlockReason(check, selectedPlan)
  const retryable = canRetryLinkedSetup(linkedSetup)
  return (
    <>
      <tr className="border-b border-white/6 text-zinc-300 hover:bg-white/[0.02]">
        <td className="px-3 py-2 text-zinc-500">{new Date(check.createdAt).toLocaleTimeString()}</td>
        <td className="px-3 py-2 font-medium text-white">{check.symbolSnapshot?.displayName ?? 'Unknown'}</td>
        <td className="px-3 py-2">{check.direction}</td>
        <td className="px-3 py-2 font-mono">{check.score ?? '—'}</td>
        <td className="px-3 py-2 font-mono">{check.rewardRiskRatio?.toFixed(2) ?? '—'}</td>
        <td className="px-3 py-2"><PermissionBadge permission={check.permission} showHelp={false} /></td>
        <td className="max-w-56 truncate px-3 py-2 text-amber-200">{check.reasonCodes?.[0] ?? check.warnings?.[0] ?? '—'}</td>
        <td className="px-3 py-2">
          <div className="flex justify-end gap-1">
            <IconAction label="View" onClick={() => onToggleExpand(check._id)}><Eye className="h-3.5 w-3.5" /></IconAction>
            <IconAction label="Archive" onClick={() => onArchive(check._id)}><Archive className="h-3.5 w-3.5" /></IconAction>
            <IconAction label="Delete" danger onClick={() => onDelete(check._id)}><Trash2 className="h-3.5 w-3.5" /></IconAction>
            {retryable && linkedSetup ? (
              <button
                className={buttonClass}
                disabled={busy}
                title="Retry rejected governed setup"
                type="button"
                onClick={() => void onRetryRejectedSetup(linkedSetup._id)}
              >
                Retry
              </button>
            ) : (
              <button
                className={buttonClass}
                disabled={busy || Boolean(blockReason)}
                title={blockReason ?? 'Convert'}
                type="button"
                onClick={() => selectedPlan && void onConvert(check._id, selectedPlan._id)}
              >
                Convert
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-white/6 bg-black/20">
          <td colSpan={8} className="px-3 py-3">
            <div className="grid gap-2 md:grid-cols-[1fr_2fr]">
              <div className="text-xs text-zinc-500">
                <p>Status: <span className="text-zinc-300">{check.scoreStatus}</span></p>
                <p>Reasons: <span className="text-zinc-300">{check.reasonCodes?.join(', ') || '—'}</span></p>
                <p>Warnings: <span className="text-amber-200">{check.warnings?.join(', ') || '—'}</span></p>
              </div>
              <input
                className={inputClass}
                placeholder="Local note / tag"
                value={note ?? ''}
                onChange={(event) => onNote(check._id, event.target.value)}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function MobileScoreCard({
  check,
  busy,
  selectedPlan,
  linkedSetup,
  onArchive,
  onDelete,
  onConvert,
  onRetryRejectedSetup,
}: {
  check: ScoreCheck
  busy: boolean
  selectedPlan?: TradePlan
  linkedSetup?: TradeSetup
  onArchive: (id: string) => void
  onDelete: (id: string) => void
  onConvert: (scoreCheckId: string, planId: string) => Promise<void>
  onRetryRejectedSetup: (tradeSetupId: string) => Promise<void>
}) {
  const blockReason = getConversionBlockReason(check, selectedPlan)
  const retryable = canRetryLinkedSetup(linkedSetup)
  return (
    <div className="rounded-md border border-white/8 bg-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-white">{check.symbolSnapshot?.displayName ?? 'Unknown'} · {check.direction}</p>
          <p className="mt-1 text-xs text-zinc-500">Score {check.score ?? '—'} · R:R {check.rewardRiskRatio?.toFixed(2) ?? '—'}</p>
        </div>
        <PermissionBadge permission={check.permission} showHelp={false} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={buttonClass} type="button" onClick={() => onArchive(check._id)}>Archive</button>
        <button className={buttonClass} type="button" onClick={() => onDelete(check._id)}>Delete</button>
        {retryable && linkedSetup ? (
          <button
            className={buttonClass}
            disabled={busy}
            type="button"
            onClick={() => void onRetryRejectedSetup(linkedSetup._id)}
          >
            Retry rejected setup
          </button>
        ) : (
          <button
            className={buttonClass}
            disabled={busy || Boolean(blockReason)}
            type="button"
            onClick={() => selectedPlan && void onConvert(check._id, selectedPlan._id)}
          >
            Convert
          </button>
        )}
      </div>
    </div>
  )
}

function ScoreScanLoader({ template }: { template: string }) {
  const rows = ['VWAP context', 'Volume / RVOL', 'CVD / order flow', 'Liquidity context', 'Risk-reward']
  return (
    <div className="relative mt-3 overflow-hidden rounded-lg border border-cyan-500/20 bg-black/40 p-3">
      <div className="absolute inset-x-0 top-0 h-px animate-[score-scan_1.4s_ease-in-out_infinite] bg-cyan-300/80 shadow-[0_0_24px_rgba(34,211,238,0.8)]" />
      <p className="text-xs font-semibold text-cyan-200">Scanning trade setup...</p>
      <p className="mt-1 text-[11px] text-zinc-500">Analyzing template: {template.replaceAll('_', ' ')}</p>
      <div className="mt-3 grid gap-1.5 sm:grid-cols-5">
        {rows.map((row, index) => (
          <div
            key={row}
            className="rounded border border-white/8 bg-white/[0.03] px-2 py-1.5 text-[11px] text-zinc-300"
            style={{ animation: `score-row 1.4s ease-in-out ${index * 120}ms infinite` }}
          >
            {row}
          </div>
        ))}
      </div>
    </div>
  )
}

function Metric({ label, value, strong = false }: { label: string; value: string | number; strong?: boolean }) {
  return (
    <div className="rounded-md border border-white/8 bg-black/25 p-2">
      <p className="text-[10px] uppercase text-zinc-600">{label}</p>
      <p className={`mt-1 truncate font-mono ${strong ? 'text-lg text-white' : 'text-xs text-zinc-300'}`}>{value}</p>
    </div>
  )
}

function IconAction({
  label,
  danger = false,
  children,
  onClick,
}: {
  label: string
  danger?: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border text-xs transition ${
        danger
          ? 'border-red-500/25 bg-red-500/10 text-red-200 hover:bg-red-500/20'
          : 'border-white/10 bg-white/5 text-zinc-300 hover:border-cyan-500/40 hover:bg-cyan-500/10'
      }`}
      title={label}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  )
}
