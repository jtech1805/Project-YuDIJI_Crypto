import { AxiosError } from 'axios'
import { Activity, BookOpen, ClipboardCheck, RefreshCw, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  closeActiveTrade,
  evaluateActiveTrade,
  listActiveTradesForPlan,
} from '../api/activeTrades'
import { createScoreCheck, convertScoreCheck, deleteScoreCheck, listScoreChecks } from '../api/scoreChecks'
import { listTradeEventsForPlan } from '../api/tradeEvents'
import {
  generateAiReview,
  listTradeJournalsForPlan,
  finalizeTradeJournal,
  updateTradeJournal,
} from '../api/tradeJournals'
import {
  archiveUserScoringTemplate,
  duplicateSystemScoringTemplate,
  getUserScoringTemplate,
  listScoringTemplates,
  updateUserScoringTemplate,
} from '../api/scoringTemplates'
import {
  activateTradePlan,
  createTradePlan,
  deleteTradePlan,
  getTradePlanDashboardSummary,
  listTradePlans,
  resetTradePlanRiskLock,
  restartTradePlan,
  updateTradePlan,
} from '../api/tradePlans'
import { createTradeJournal, listTradeResultsForPlan } from '../api/tradeResults'
import {
  cancelTradeSetup,
  confirmActualTrade,
  deleteTradeSetup,
  listTradeSetupsForPlan,
  retryTradeSetupRiskCheck,
} from '../api/tradeSetups'
import { ActiveTradePanel } from '../components/trading/ActiveTradePanel'
import { ScoreCheckPanel } from '../components/trading/ScoreCheckPanel'
import { SymbolPicker } from '../components/trading/SymbolPicker'
import { TradePlanPanel } from '../components/trading/TradePlanPanel'
import { TradeReviewPanel } from '../components/trading/TradeReviewPanel'
import { TradeSetupPanel } from '../components/trading/TradeSetupPanel'
import { buttonClass, inputClass } from '../components/trading/trading-ui'
import { WorkflowStepper } from '../components/trading/WorkflowStepper'
import { useAuth } from '../context/AuthContext'
import { useWebSocket } from '../context/WebSocketContext'
import type { SymbolSearchResult } from '../api/symbols'
import type {
  ActiveTrade,
  AiExplanation,
  CloseActiveTradeInput,
  ConfirmActualTradeInput,
  CreateScoreCheckInput,
  CreateTradePlanInput,
  RestartTradePlanInput,
  ResetRiskLockInput,
  ScoringTemplateSummary,
  ScoringTemplateDetail,
  ScoringTemplateResourceConfig,
  ScoringTemplateSectionOverride,
  ScoringTemplateSnapshotPolicy,
  ScoreCheck,
  TradeJournal,
  TradePlan,
  TradePlanDashboardSummary,
  TradeResult,
  TradeSetup,
  UpdateTradePlanInput,
  UpdateTradeJournalInput,
} from '../types/trade'

function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    if (error.response?.status === 401) return 'Your session has expired. Please sign in again.'
    if (error.code === 'ERR_NETWORK') {
      return 'YuJiDi API is unreachable. Confirm the backend server is running and try again.'
    }
    const message = error.response?.data?.message
    if (typeof message === 'string') return message
  }
  return error instanceof Error ? error.message : 'Request failed'
}

export function TradingWorkflow() {
  const [plans, setPlans] = useState<TradePlan[]>([])
  const [scoreChecks, setScoreChecks] = useState<ScoreCheck[]>([])
  const [scoringTemplates, setScoringTemplates] = useState<ScoringTemplateSummary[]>([])
  const [setups, setSetups] = useState<TradeSetup[]>([])
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([])
  const [results, setResults] = useState<TradeResult[]>([])
  const [journals, setJournals] = useState<TradeJournal[]>([])
  const [reviews, setReviews] = useState<Record<string, AiExplanation>>({})
  const [planSummary, setPlanSummary] = useState<TradePlanDashboardSummary | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'setups' | 'active' | 'review'>('setups')
  const [showResetRiskModal, setShowResetRiskModal] = useState(false)
  const [showRestartModal, setShowRestartModal] = useState(false)
  const [templateEditor, setTemplateEditor] = useState<ScoringTemplateDetail | null>(null)
  const [showTemplateCreator, setShowTemplateCreator] = useState(false)
  const [requestedScoreTemplateSelection, setRequestedScoreTemplateSelection] = useState<string | undefined>()
  const { checkAuth } = useAuth()
  const { connectionStatus, tradeEvents, setInitialTradeEvents } = useWebSocket()

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan._id === selectedPlanId),
    [plans, selectedPlanId],
  )
  const workflowSteps = useMemo(() => {
    const hasPlan = plans.some((plan) => plan.status === 'ACTIVE')
    const hasScore = scoreChecks.length > 0
    const hasSetup = setups.length > 0
    const hasTrade = activeTrades.length > 0
    const hasEvent = tradeEvents.length > 0
    const hasResult = results.length > 0
    const hasJournal = journals.length > 0
    const hasReview =
      Object.keys(reviews).length > 0 || journals.some((journal) => Boolean(journal.aiReviewId))
    return [
      { label: 'Plan', complete: hasPlan, nextAction: hasPlan ? 'Active plan selected' : 'Create and activate a plan' },
      { label: 'Score', complete: hasScore, nextAction: hasScore ? 'Score recorded' : 'Run a score check' },
      { label: 'Setup', complete: hasSetup, nextAction: hasSetup ? 'Governed setup created' : 'Convert a compatible score' },
      { label: 'Active Trade', complete: hasTrade, nextAction: hasTrade ? 'Actual trade confirmed' : 'Confirm the actual trade manually' },
      { label: 'Events', complete: hasEvent, nextAction: hasEvent ? 'Trade events available' : 'Monitor or manually evaluate price' },
      { label: 'Close', complete: hasResult, nextAction: hasResult ? 'Result recorded' : 'Manually close when your trade ends' },
      { label: 'Journal', complete: hasJournal, nextAction: hasJournal ? 'Journal created' : 'Create and finalize reflection' },
      { label: 'AI Review', complete: hasReview, nextAction: hasReview ? 'Coaching review available' : 'Generate after journal finalization' },
    ]
  }, [activeTrades, journals, plans, results, reviews, scoreChecks, setups, tradeEvents])

  const loadWorkflow = useCallback(async () => {
    setError(null)
    try {
      const [nextPlans, nextScoreChecks, nextScoringTemplates] = await Promise.all([
        listTradePlans(),
        listScoreChecks(),
        listScoringTemplates(),
      ])
      setPlans(nextPlans)
      setScoreChecks(nextScoreChecks)
      setScoringTemplates(nextScoringTemplates)
      setSelectedPlanId((current) => {
        if (current && nextPlans.some((plan) => plan._id === current)) return current
        return nextPlans.find((plan) => plan.status === 'ACTIVE')?._id ?? nextPlans[0]?._id ?? ''
      })
    } catch (requestError) {
      setError(getErrorMessage(requestError))
      if (requestError instanceof AxiosError && requestError.response?.status === 401) {
        await checkAuth()
      }
    } finally {
      setLoading(false)
    }
  }, [checkAuth, setInitialTradeEvents])

  const loadSelectedPlanContext = useCallback(async (tradePlanId: string) => {
    const [
      nextSetups,
      nextTrades,
      nextEvents,
      nextResults,
      nextJournals,
      nextSummary,
    ] = await Promise.all([
      listTradeSetupsForPlan(tradePlanId),
      listActiveTradesForPlan(tradePlanId),
      listTradeEventsForPlan(tradePlanId),
      listTradeResultsForPlan(tradePlanId),
      listTradeJournalsForPlan(tradePlanId),
      getTradePlanDashboardSummary(tradePlanId),
    ])
    setSetups(nextSetups)
    setActiveTrades(nextTrades)
    setInitialTradeEvents(nextEvents)
    setResults(nextResults)
    setJournals(nextJournals)
    setPlanSummary(nextSummary)
  }, [setInitialTradeEvents])

  useEffect(() => {
    void loadWorkflow()
  }, [loadWorkflow])

  useEffect(() => {
    if (!selectedPlanId) {
      setPlanSummary(null)
      setSetups([])
      setActiveTrades([])
      setInitialTradeEvents([])
      setResults([])
      setJournals([])
      return
    }
    let isMounted = true
    loadSelectedPlanContext(selectedPlanId)
      .catch((requestError) => {
        if (!isMounted) return
        setError(getErrorMessage(requestError))
        setPlanSummary(null)
      })
    return () => {
      isMounted = false
    }
  }, [loadSelectedPlanContext, selectedPlanId, setInitialTradeEvents])

  const run = async (operation: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await operation()
    } catch (requestError) {
      setError(getErrorMessage(requestError))
      if (requestError instanceof AxiosError && requestError.response?.status === 401) {
        await checkAuth()
      }
    } finally {
      setBusy(false)
    }
  }

  const retryRejectedSetup = async (tradeSetupId: string) =>
    run(async () => {
      const reason = window.prompt('Reason for retry', 'Retry after risk lock reset')
      if (!reason?.trim()) return
      const result = await retryTradeSetupRiskCheck(tradeSetupId, { reason })
      setSetups((current) =>
        current.map((setup) => (setup._id === tradeSetupId ? result.tradeSetup : setup)),
      )
      setActiveTab('setups')
      if (selectedPlanId) await loadSelectedPlanContext(selectedPlanId)
    })

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
            <h1 className="text-xl font-semibold text-white">Trading Workflow</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Risk permission, manual trade confirmation, monitoring, and review
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
            <span
              className={`h-2 w-2 rounded-full ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-400'
                  : connectionStatus === 'connecting'
                    ? 'bg-amber-400'
                    : 'bg-zinc-600'
              }`}
            />
            Market event stream {connectionStatus}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-400">
            {scoreChecks.length} scores · {setups.length} setups · {tradeEvents.length} events
          </span>
          <button
            className={buttonClass}
            disabled={busy || loading}
            type="button"
            onClick={() => void loadWorkflow()}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-sm text-zinc-500">Loading trading workflow</div>
      ) : (
        <>
          <WorkflowStepper steps={workflowSteps} />
          <PlanDashboardSummary
            summary={planSummary}
            currency={selectedPlan?.currency ?? 'USD'}
            onEditPlan={() => {
              const editButton = document.querySelector<HTMLButtonElement>(
                `[data-edit-plan-id="${selectedPlanId}"]`,
              )
              editButton?.click()
            }}
            onResetRisk={() => setShowResetRiskModal(true)}
            onRestartPlan={() => setShowRestartModal(true)}
          />
          <ScoringTemplateManager
            templates={scoringTemplates}
            busy={busy}
            onCreate={() => setShowTemplateCreator(true)}
            onDuplicate={async (templateKey, templateName) =>
              run(async () => {
                if (!templateName?.trim()) return
                await duplicateSystemScoringTemplate(templateKey, { templateName })
                setScoringTemplates(await listScoringTemplates())
              })
            }
            onRename={async (templateId, currentName) =>
              run(async () => {
                const templateName = window.prompt('Template name', currentName)
                if (!templateName?.trim()) return
                await updateUserScoringTemplate(templateId, { templateName })
                setScoringTemplates(await listScoringTemplates())
              })
            }
            onConfigure={async (templateId) =>
              run(async () => {
                setTemplateEditor(await getUserScoringTemplate(templateId))
              })
            }
            onArchive={async (templateId) =>
              run(async () => {
                await archiveUserScoringTemplate(templateId)
                setScoringTemplates(await listScoringTemplates())
              })
            }
            onUseInScoreCheck={(templateId) => {
              setRequestedScoreTemplateSelection(`user:${templateId}`)
              window.setTimeout(() => {
                document.getElementById('score-check-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }, 0)
            }}
          />
          <ScoringTemplateCreateModal
            busy={busy}
            open={showTemplateCreator}
            systemTemplates={scoringTemplates.filter((template) => template.scope === 'SYSTEM')}
            onCancel={() => setShowTemplateCreator(false)}
            onCreate={async (templateKey, input) =>
              run(async () => {
                const created = await duplicateSystemScoringTemplate(templateKey, input)
                setShowTemplateCreator(false)
                setTemplateEditor(created)
                setScoringTemplates(await listScoringTemplates())
              })
            }
          />
          <ScoringTemplateResourceModal
            busy={busy}
            template={templateEditor}
            onCancel={() => setTemplateEditor(null)}
            onSave={async (templateId, input) =>
              run(async () => {
                await updateUserScoringTemplate(templateId, input)
                setTemplateEditor(null)
                setScoringTemplates(await listScoringTemplates())
              })
            }
          />
          <div className="grid gap-4 xl:grid-cols-[0.85fr_1.35fr]">
            <TradePlanPanel
              plans={plans}
              selectedPlanId={selectedPlanId}
              busy={busy}
              onSelect={setSelectedPlanId}
              onCreate={async (input: CreateTradePlanInput) =>
                run(async () => {
                  const plan = await createTradePlan(input)
                  setPlans((current) => [plan, ...current])
                  setSelectedPlanId(plan._id)
                })
              }
              onActivate={async (id) =>
                run(async () => {
                  const plan = await activateTradePlan(id)
                  setPlans((current) => current.map((item) => (item._id === id ? plan : item)))
                  setSelectedPlanId(id)
                })
              }
              onUpdate={async (id: string, input: UpdateTradePlanInput) =>
                run(async () => {
                  const plan = await updateTradePlan(id, input)
                  setPlans((current) => current.map((item) => (item._id === id ? plan : item)))
                  setSelectedPlanId(id)
                  await loadSelectedPlanContext(id)
                })
              }
              onDelete={async (id) =>
                run(async () => {
                  await deleteTradePlan(id, {
                    reason: 'User deleted trade plan from dashboard',
                    cascade: true,
                  })
                  await loadWorkflow()
                })
              }
            />
            <div id="score-check-panel">
              <ScoreCheckPanel
                scoreChecks={scoreChecks}
                setups={setups}
                scoringTemplates={scoringTemplates}
                selectedPlan={selectedPlan}
                requestedTemplateSelection={requestedScoreTemplateSelection}
                busy={busy}
                onCreate={async (input: CreateScoreCheckInput) =>
                  run(async () => {
                    const check = await createScoreCheck(input)
                    setScoreChecks((current) => [check, ...current])
                  })
                }
                onConvert={async (scoreCheckId, planId) =>
                  run(async () => {
                    const setup = await convertScoreCheck(scoreCheckId, planId)
                    setSetups((current) => [setup, ...current])
                    setActiveTab('setups')
                    await loadSelectedPlanContext(planId)
                    setScoreChecks((current) =>
                      current.map((check) =>
                        check._id === scoreCheckId
                          ? { ...check, convertedToTradeSetupId: setup._id }
                          : check,
                      ),
                    )
                  })
                }
                onRetryRejectedSetup={retryRejectedSetup}
                onDelete={async (id) =>
                  run(async () => {
                    await deleteScoreCheck(id, 'User deleted score check from dashboard')
                    await loadWorkflow()
                  })
                }
                onTemplateSelectionConsumed={() => setRequestedScoreTemplateSelection(undefined)}
              />
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-white/8 bg-zinc-950/70">
            <div className="flex gap-1 overflow-x-auto border-b border-white/8 p-2">
              {[
                { id: 'setups', label: 'Governed Setups', count: setups.length, icon: ClipboardCheck },
                { id: 'active', label: 'Active Trades / Events', count: activeTrades.length + tradeEvents.length, icon: Activity },
                { id: 'review', label: 'Journal / AI Review', count: results.length + journals.length, icon: BookOpen },
              ].map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold transition ${
                      activeTab === tab.id
                        ? 'bg-cyan-500/12 text-cyan-200'
                        : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'
                    }`}
                    type="button"
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                    <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px]">{tab.count}</span>
                  </button>
                )
              })}
            </div>
            <div className="p-3">
              {activeTab === 'setups' && (
                <TradeSetupPanel
                  setups={setups}
                  busy={busy}
                  onConfirm={async (id: string, input: ConfirmActualTradeInput) =>
                    run(async () => {
                      const trade = await confirmActualTrade(id, input)
                      setActiveTrades((current) => [trade, ...current])
                      setActiveTab('active')
                      setSetups((current) =>
                        current.map((setup) =>
                          setup._id === id ? { ...setup, status: 'EXECUTED' } : setup,
                        ),
                      )
                      if (selectedPlanId) await loadSelectedPlanContext(selectedPlanId)
                    })
                  }
                  onCancel={async (id) =>
                    run(async () => {
                      const setup = await cancelTradeSetup(id)
                      setSetups((current) => current.map((item) => (item._id === id ? setup : item)))
                      if (selectedPlanId) await loadSelectedPlanContext(selectedPlanId)
                    })
                  }
                  onRetry={retryRejectedSetup}
                  onDelete={async (id) =>
                    run(async () => {
                      await deleteTradeSetup(id, { reason: 'User deleted setup from dashboard' })
                      if (selectedPlanId) await loadSelectedPlanContext(selectedPlanId)
                    })
                  }
                />
              )}
              {activeTab === 'active' && (
                <ActiveTradePanel
                  trades={activeTrades}
                  events={tradeEvents}
                  busy={busy}
                  onEvaluate={async (id, price) => {
                    setBusy(true)
                    setError(null)
                    try {
                      return await evaluateActiveTrade(id, price)
                    } catch (requestError) {
                      setError(getErrorMessage(requestError))
                      throw requestError
                    } finally {
                      setBusy(false)
                    }
                  }}
                  onClose={async (id: string, input: CloseActiveTradeInput) =>
                    run(async () => {
                      const result = await closeActiveTrade(id, input)
                      setResults((current) => [result, ...current])
                      setActiveTrades((current) =>
                        current.map((trade) =>
                          trade._id === id ? { ...trade, status: 'CLOSED' } : trade,
                        ),
                      )
                      setActiveTab('review')
                      if (selectedPlanId) await loadSelectedPlanContext(selectedPlanId)
                    })
                  }
                />
              )}
              {activeTab === 'review' && (
                <TradeReviewPanel
                  results={results}
                  journals={journals}
                  reviews={reviews}
                  busy={busy}
                  onCreateJournal={async (resultId) =>
                    run(async () => {
                      const journal = await createTradeJournal(resultId)
                      setJournals((current) => [journal, ...current])
                      if (selectedPlanId) await loadSelectedPlanContext(selectedPlanId)
                    })
                  }
                  onUpdateJournal={async (journalId: string, input: UpdateTradeJournalInput) =>
                    run(async () => {
                      const journal = await updateTradeJournal(journalId, input)
                      setJournals((current) =>
                        current.map((item) => (item._id === journalId ? journal : item)),
                      )
                      if (selectedPlanId) await loadSelectedPlanContext(selectedPlanId)
                    })
                  }
                  onSaveAndFinalizeJournal={async (journalId, input) =>
                    run(async () => {
                      await updateTradeJournal(journalId, input)
                      const journal = await finalizeTradeJournal(journalId)
                      setJournals((current) =>
                        current.map((item) => (item._id === journalId ? journal : item)),
                      )
                      if (selectedPlanId) await loadSelectedPlanContext(selectedPlanId)
                    })
                  }
                  onGenerateReview={async (journalId) =>
                    run(async () => {
                      const review = await generateAiReview(journalId)
                      setReviews((current) => ({ ...current, [journalId]: review }))
                    })
                  }
                />
              )}
            </div>
          </div>
          {selectedPlan && (
            <>
              <ResetRiskLockModal
                open={showResetRiskModal}
                busy={busy}
                planName={selectedPlan.name}
                onCancel={() => setShowResetRiskModal(false)}
                onConfirm={async (input) =>
                  run(async () => {
                    await resetTradePlanRiskLock(selectedPlan._id, input)
                    setShowResetRiskModal(false)
                    await loadSelectedPlanContext(selectedPlan._id)
                  })
                }
              />
              <RestartPlanModal
                open={showRestartModal}
                busy={busy}
                plan={selectedPlan}
                onCancel={() => setShowRestartModal(false)}
                onConfirm={async (input) =>
                  run(async () => {
                    const result = await restartTradePlan(selectedPlan._id, input)
                    setShowRestartModal(false)
                    await loadWorkflow()
                    setSelectedPlanId(result.newTradePlan._id)
                  })
                }
              />
            </>
          )}
        </>
      )}
    </div>
  )
}

function PlanDashboardSummary({
  summary,
  currency,
  onEditPlan,
  onResetRisk,
  onRestartPlan,
}: {
  summary: TradePlanDashboardSummary | null
  currency: string
  onEditPlan: () => void
  onResetRisk: () => void
  onRestartPlan: () => void
}) {
  if (!summary) {
    return (
      <div className="mb-4 rounded-lg border border-white/8 bg-zinc-950/70 p-4 text-sm text-zinc-500">
        Select a trade plan to view capital, capacity, and P&amp;L summary.
      </div>
    )
  }

  const money = (value: number) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value)
  const number = (value: number) =>
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
  const statusStyle = summary.risk.canTakeNextTrade
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
    : 'border-red-500/30 bg-red-500/10 text-red-200'

  return (
    <section className="mb-4 rounded-lg border border-white/8 bg-zinc-950/70 p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">{summary.plan.name}</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {summary.plan.marketType} · {summary.plan.instrumentType} · {summary.plan.tradeStyle} · {summary.plan.status}
          </p>
        </div>
        <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${statusStyle}`}>
          {summary.risk.canTakeNextTrade ? 'Ready for next trade' : summary.risk.blockReasons.join(', ')}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryMetric
          label="Capital"
          value={`${money(summary.capital.startingCapital)} → ${money(summary.capital.currentCapital)}`}
          helper={`Available ${money(summary.capital.availableCapital)}`}
        />
        <SummaryMetric
          label="Realized P&L"
          value={money(summary.capital.realizedNetPnl)}
          helper={`${summary.capital.pnlBasis.replaceAll('_', ' ')} · Gross ${money(summary.capital.realizedGrossPnl)}`}
        />
        <SummaryMetric
          label="Trade Capacity"
          value={`${summary.plan.usedTrades}/${summary.plan.allowedTrades ?? '∞'}`}
          helper={`Remaining ${summary.plan.remainingTrades ?? 'unlimited'} · Open risk ${money(summary.capital.openRiskAmount)}`}
        />
        <SummaryMetric
          label="Performance"
          value={`${number(summary.performance.winRate)}% win`}
          helper={`${summary.performance.totalClosedTrades} closed · ${number(summary.performance.totalRealizedR)}R`}
        />
      </div>
      {!summary.risk.canTakeNextTrade && (
        <div className="mt-4 rounded-md border border-red-500/25 bg-red-500/10 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-red-100">Trading is blocked for this plan.</h3>
              <p className="mt-1 text-xs leading-5 text-red-100/80">
                Risk lock active. Current capital remains based on historical results.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[...summary.risk.blockReasons, ...(summary.risk.stopTradingReasons ?? [])].map((reason) => (
                  <span key={reason} className="rounded border border-red-400/25 px-2 py-1 text-[11px] text-red-100">
                    {reason}
                  </span>
                ))}
              </div>
              {summary.risk.hasOpenTrades && (
                <p className="mt-2 text-xs text-red-100/70">
                  Close or cancel open active trades before reset or restart.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={buttonClass} disabled={!summary.risk.resetAvailable} type="button" onClick={onResetRisk}>
                Reset Risk Lock
              </button>
              <button className={buttonClass} disabled={!summary.risk.restartAvailable} type="button" onClick={onRestartPlan}>
                Restart Plan
              </button>
              <button className={buttonClass} type="button" onClick={onEditPlan}>
                Edit Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function SummaryMetric({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper: string
}) {
  return (
    <div className="rounded-md border border-white/8 bg-white/[0.02] p-3">
      <p className="text-[11px] font-medium uppercase text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{helper}</p>
    </div>
  )
}

function ScoringTemplateManager({
  templates,
  busy,
  onCreate,
  onDuplicate,
  onRename,
  onConfigure,
  onArchive,
  onUseInScoreCheck,
}: {
  templates: ScoringTemplateSummary[]
  busy: boolean
  onCreate: () => void
  onDuplicate: (templateKey: string, templateName: string) => Promise<void>
  onRename: (templateId: string, currentName: string) => Promise<void>
  onConfigure: (templateId: string) => Promise<void>
  onArchive: (templateId: string) => Promise<void>
  onUseInScoreCheck: (templateId: string) => void
}) {
  const systemTemplates = templates.filter((template) => template.scope === 'SYSTEM')
  const userTemplates = templates.filter((template) => template.scope === 'USER')

  return (
    <section className="mb-4 rounded-lg border border-white/8 bg-zinc-950/70 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">Scoring Templates</h2>
          <p className="mt-1 text-xs text-zinc-500">Create sector, commodity, crypto, or macro-aware scoring templates.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-zinc-400">
            {systemTemplates.length} system · {userTemplates.length} custom
          </span>
          <button className={buttonClass} disabled={busy} type="button" onClick={onCreate}>
            Create Template
          </button>
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-[0.7fr_1.3fr]">
        <div className="rounded-md border border-white/8 bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-zinc-300">System bases</p>
            <span className="text-[11px] text-zinc-600">readonly</span>
          </div>
          <div className="space-y-1.5">
            {systemTemplates.map((template) => (
              <div
                key={template.templateKey}
                className="flex items-center justify-between gap-2 rounded-md border border-white/5 bg-white/[0.02] px-2 py-1.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-white">{template.templateName}</p>
                  <p className="truncate text-[10px] uppercase text-zinc-600">
                    {template.marketType} · {template.tradeStyle} · {template.instrumentType}
                  </p>
                </div>
                <button
                  className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/5 disabled:opacity-50"
                  disabled={busy}
                  type="button"
                  onClick={() => void onDuplicate(template.templateKey, `${template.templateName} Custom`)}
                >
                  Copy
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-cyan-500/15 bg-cyan-500/[0.025]">
          <div className="grid grid-cols-[minmax(0,1.4fr)_0.55fr_0.6fr_0.7fr] gap-2 border-b border-white/8 px-3 py-2 text-[10px] uppercase tracking-wide text-zinc-600">
            <span>Custom template</span>
            <span>Resources</span>
            <span>Allowed</span>
            <span className="text-right">Actions</span>
          </div>
          {userTemplates.length === 0 ? (
            <div className="px-3 py-5 text-center text-xs text-zinc-500">No custom templates yet.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {userTemplates.map((template) => {
                const resources = templateResourceLabels(template)
                const allowedCount = template.allowedTradableSymbols?.length ?? 0
                return (
                  <div
                    key={template.id ?? template.templateKey}
                    className="grid grid-cols-[minmax(0,1.4fr)_0.55fr_0.6fr_0.7fr] items-center gap-2 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-cyan-100">{template.templateName}</p>
                      <p className="mt-0.5 truncate text-[11px] uppercase text-zinc-500">
                        {template.status} · {template.marketType} · {template.tradeStyle} · {template.instrumentType} · v{template.version}
                      </p>
                    </div>
                    <span className="truncate text-[11px] text-zinc-400">{resources.join(', ') || 'none'}</span>
                    <span className={allowedCount > 0 ? 'text-[11px] text-emerald-300' : 'text-[11px] text-amber-300'}>
                      {allowedCount} symbols
                    </span>
                    <div className="flex justify-end gap-1">
                      <button
                        className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/5 disabled:opacity-50"
                        disabled={busy || !template.id}
                        type="button"
                        onClick={() => template.id && void onConfigure(template.id)}
                      >
                        Configure
                      </button>
                      <button
                        className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/5 disabled:opacity-50"
                        disabled={busy || !template.id || allowedCount === 0}
                        title={allowedCount === 0 ? 'Add allowed tradable symbols first' : 'Use in ScoreCheck'}
                        type="button"
                        onClick={() => template.id && onUseInScoreCheck(template.id)}
                      >
                        Use
                      </button>
                      <button
                        className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/5 disabled:opacity-50"
                        disabled={busy || !template.id}
                        type="button"
                        onClick={() => template.id && void onRename(template.id, template.templateName)}
                      >
                        Rename
                      </button>
                      <button
                        className="rounded-md border border-red-500/30 px-2 py-1 text-[11px] text-red-200 hover:bg-red-500/10 disabled:opacity-50"
                        disabled={busy || !template.id}
                        type="button"
                        onClick={() => template.id && void onArchive(template.id)}
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function templateResourceLabels(template: ScoringTemplateSummary) {
  return [
    template.resourceConfig?.marketRegime?.marketIndexSymbolId ? 'market' : null,
    template.resourceConfig?.marketRegime?.bankIndexSymbolId ? 'bank' : null,
    template.resourceConfig?.marketRegime?.volatilitySymbolId ? 'vol' : null,
    template.resourceConfig?.sectorContext?.sectorIndexSymbolId ? 'sector' : null,
    template.resourceConfig?.relatedSymbols?.length ? `${template.resourceConfig.relatedSymbols.length} rel` : null,
  ].filter((item): item is string => Boolean(item))
}

type TemplateResourceUpdateInput = {
  templateName?: string
  description?: string
  resourceConfig: ScoringTemplateResourceConfig
  allowedTradableSymbols: string[]
  sectionOverrides: ScoringTemplateSectionOverride[]
  snapshotPolicy: ScoringTemplateSnapshotPolicy
}

type TemplateCreateInput = {
  templateName: string
  description?: string
  resourceConfig?: ScoringTemplateResourceConfig
  allowedTradableSymbols?: string[]
  sectionOverrides?: ScoringTemplateSectionOverride[]
  snapshotPolicy?: ScoringTemplateSnapshotPolicy
}

function ScoringTemplateCreateModal({
  open,
  busy,
  systemTemplates,
  onCancel,
  onCreate,
}: {
  open: boolean
  busy: boolean
  systemTemplates: ScoringTemplateSummary[]
  onCancel: () => void
  onCreate: (templateKey: string, input: TemplateCreateInput) => Promise<void>
}) {
  const firstTemplate = systemTemplates[0]
  const [templateKey, setTemplateKey] = useState(firstTemplate?.templateKey ?? '')
  const [templateName, setTemplateName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!open) return
    const nextKey = firstTemplate?.templateKey ?? ''
    setTemplateKey(nextKey)
    setTemplateName(firstTemplate ? `${firstTemplate.templateName} Custom` : '')
    setDescription('')
  }, [firstTemplate, open])

  if (!open) return null
  const selected = systemTemplates.find((template) => template.templateKey === templateKey)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <form
        className="w-full max-w-xl rounded-lg border border-cyan-500/30 bg-zinc-950 p-4 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault()
          if (!templateKey || !templateName.trim()) return
          void onCreate(templateKey, {
            templateName: templateName.trim(),
            ...(description.trim() ? { description: description.trim() } : {}),
          })
        }}
      >
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-white">Create scoring template</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Custom templates start from a readonly system model, then you configure symbols, resources, and weights.
          </p>
        </div>
        <label className="block text-xs text-zinc-500">
          Base model
          <select
            className={`${inputClass} mt-1`}
            value={templateKey}
            onChange={(event) => {
              const next = systemTemplates.find((template) => template.templateKey === event.target.value)
              setTemplateKey(event.target.value)
              setTemplateName(next ? `${next.templateName} Custom` : templateName)
            }}
          >
            {systemTemplates.map((template) => (
              <option key={template.templateKey} value={template.templateKey}>
                {template.templateName} · {template.marketType} · {template.instrumentType}
              </option>
            ))}
          </select>
        </label>
        {selected && (
          <div className="mt-3 grid gap-2 rounded-md border border-white/8 bg-black/20 p-3 text-[11px] text-zinc-500 sm:grid-cols-3">
            <p>Market <span className="block text-zinc-300">{selected.marketType}</span></p>
            <p>Style <span className="block text-zinc-300">{selected.tradeStyle}</span></p>
            <p>Instrument <span className="block text-zinc-300">{selected.instrumentType}</span></p>
          </div>
        )}
        <label className="mt-3 block text-xs text-zinc-500">
          Template name
          <input
            className={`${inputClass} mt-1`}
            maxLength={120}
            placeholder="Metal Intraday Template"
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
          />
        </label>
        <label className="mt-3 block text-xs text-zinc-500">
          Description
          <textarea
            className="mt-1 h-20 w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-2 text-sm text-white outline-none transition focus:border-cyan-500/60"
            maxLength={1000}
            placeholder="What this template should score and when it should be used"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button className={buttonClass} disabled={busy} type="button" onClick={onCancel}>Cancel</button>
          <button className={buttonClass} disabled={busy || !templateKey || !templateName.trim()} type="submit">
            Create and configure
          </button>
        </div>
      </form>
    </div>
  )
}

function ScoringTemplateResourceModal({
  template,
  busy,
  onCancel,
  onSave,
}: {
  template: ScoringTemplateDetail | null
  busy: boolean
  onCancel: () => void
  onSave: (templateId: string, input: TemplateResourceUpdateInput) => Promise<void>
}) {
  const [templateName, setTemplateName] = useState('')
  const [description, setDescription] = useState('')
  const [resourceConfig, setResourceConfig] = useState<ScoringTemplateResourceConfig>({})
  const [allowedTradableSymbols, setAllowedTradableSymbols] = useState<string[]>([])
  const [sectionOverrides, setSectionOverrides] = useState<ScoringTemplateSectionOverride[]>([])
  const [snapshotPolicy, setSnapshotPolicy] = useState<ScoringTemplateSnapshotPolicy>({
    captureMarketRegime: true,
    captureSectorContext: true,
    captureRelatedSymbols: true,
    captureAllowedTradableSymbol: true,
    maxSnapshotAgeSeconds: 900,
  })

  useEffect(() => {
    if (!template) return
    setTemplateName(template.templateName)
    setDescription(template.description ?? '')
    setResourceConfig(template.resourceConfig ?? {})
    setAllowedTradableSymbols(template.allowedTradableSymbols ?? [])
    setSectionOverrides(
      template.sectionOverrides?.length
        ? template.sectionOverrides
        : template.sections.map((section) => ({
            sectionKey: section.sectionKey,
            weight: section.weight,
            enabled: section.enabled,
          })),
    )
    setSnapshotPolicy(
      template.snapshotPolicy ?? {
        captureMarketRegime: true,
        captureSectorContext: true,
        captureRelatedSymbols: true,
        captureAllowedTradableSymbol: true,
        maxSnapshotAgeSeconds: 900,
      },
    )
  }, [template])

  if (!template?.id) return null

  const setMarketRegimeSymbol = (
    key: 'marketIndexSymbolId' | 'bankIndexSymbolId' | 'volatilitySymbolId',
    symbol: SymbolSearchResult | null,
  ) => {
    setResourceConfig((current) => ({
      ...current,
      marketRegime: {
        ...(current.marketRegime ?? {}),
        ...(symbol ? { [key]: symbol.symbolId } : { [key]: undefined }),
      },
    }))
  }

  const setSectorIndexSymbol = (symbol: SymbolSearchResult | null) => {
    setResourceConfig((current) => ({
      ...current,
      sectorContext: {
        ...(current.sectorContext ?? {}),
        ...(symbol ? { sectorIndexSymbolId: symbol.symbolId } : { sectorIndexSymbolId: undefined }),
      },
    }))
  }

  const addRelatedSymbol = (symbol: SymbolSearchResult | null) => {
    if (!symbol) return
    setResourceConfig((current) => {
      const relatedSymbols = current.relatedSymbols ?? []
      return {
        ...current,
        relatedSymbols: relatedSymbols.includes(symbol.symbolId)
          ? relatedSymbols
          : [...relatedSymbols, symbol.symbolId],
      }
    })
  }

  const addAllowedSymbol = (symbol: SymbolSearchResult | null) => {
    if (!symbol) return
    setAllowedTradableSymbols((current) =>
      current.includes(symbol.symbolId) ? current : [...current, symbol.symbolId],
    )
  }

  const enabledWeightTotal = sectionOverrides
    .filter((section) => section.enabled)
    .reduce((total, section) => total + Number(section.weight || 0), 0)
  const duplicateAllowedCount = allowedTradableSymbols.length - new Set(allowedTradableSymbols).size
  const missingAllowedSymbols = allowedTradableSymbols.length === 0
  const missingMarketIndex = !resourceConfig.marketRegime?.marketIndexSymbolId
  const canSave =
    !busy &&
    templateName.trim().length > 0 &&
    duplicateAllowedCount === 0 &&
    !missingAllowedSymbols &&
    Math.abs(enabledWeightTotal - 100) <= 0.001

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <form
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-cyan-500/30 bg-zinc-950 p-4 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault()
          void onSave(template.id!, {
            templateName: templateName.trim(),
            description: description.trim(),
            resourceConfig,
            allowedTradableSymbols,
            sectionOverrides,
            snapshotPolicy,
          })
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Configure scoring template</h3>
            <p className="mt-1 text-xs text-zinc-500">System templates are readonly. Custom templates can be edited here.</p>
          </div>
          <span className="rounded-md border border-white/10 px-2 py-1 text-[11px] uppercase text-zinc-500">
            {template.marketType} · {template.instrumentType}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-[0.7fr_1fr]">
          <label className="block text-xs text-zinc-500">
            Template name
            <input
              className={`${inputClass} mt-1`}
              maxLength={120}
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
            />
          </label>
          <label className="block text-xs text-zinc-500">
            Description
            <input
              className={`${inputClass} mt-1`}
              maxLength={1000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <TemplateSymbolField
            label="Market index"
            value={resourceConfig.marketRegime?.marketIndexSymbolId}
            onSelect={(symbol) => setMarketRegimeSymbol('marketIndexSymbolId', symbol)}
          />
          <TemplateSymbolField
            label="Bank index"
            value={resourceConfig.marketRegime?.bankIndexSymbolId}
            onSelect={(symbol) => setMarketRegimeSymbol('bankIndexSymbolId', symbol)}
          />
          <TemplateSymbolField
            label="Volatility symbol"
            value={resourceConfig.marketRegime?.volatilitySymbolId}
            onSelect={(symbol) => setMarketRegimeSymbol('volatilitySymbolId', symbol)}
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[0.7fr_1fr]">
          <label className="block text-xs text-zinc-500">
            Sector name
            <input
              className={`${inputClass} mt-1`}
              value={resourceConfig.sectorContext?.sectorName ?? ''}
              onChange={(event) =>
                setResourceConfig((current) => ({
                  ...current,
                  sectorContext: {
                    ...(current.sectorContext ?? {}),
                    sectorName: event.target.value,
                  },
                }))
              }
            />
          </label>
          <TemplateSymbolField
            label="Sector index"
            value={resourceConfig.sectorContext?.sectorIndexSymbolId}
            onSelect={setSectorIndexSymbol}
          />
        </div>

        <div className="mt-4 rounded-md border border-white/8 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-white">Related symbols</p>
            <span className="text-[11px] text-zinc-500">{resourceConfig.relatedSymbols?.length ?? 0} selected</span>
          </div>
          <TemplateSymbolField label="Add related symbol" onSelect={addRelatedSymbol} />
          <SymbolIdChips
            symbolIds={resourceConfig.relatedSymbols ?? []}
            onRemove={(symbolId) =>
              setResourceConfig((current) => ({
                ...current,
                relatedSymbols: (current.relatedSymbols ?? []).filter((item) => item !== symbolId),
              }))
            }
          />
          <p className="mt-2 text-[11px] text-zinc-500">Related symbols are context resources; missing related snapshots warn but do not block scoring.</p>
        </div>

        <div className="mt-4 rounded-md border border-white/8 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-white">Allowed tradable symbols</p>
            <span className="text-[11px] text-zinc-500">{allowedTradableSymbols.length} selected</span>
          </div>
          <TemplateSymbolField label="Add allowed symbol" onSelect={addAllowedSymbol} />
          <SymbolIdChips
            symbolIds={allowedTradableSymbols}
            onRemove={(symbolId) => setAllowedTradableSymbols((current) => current.filter((item) => item !== symbolId))}
          />
          <p className={`mt-2 text-[11px] ${missingAllowedSymbols ? 'text-amber-300' : 'text-zinc-500'}`}>
            {missingAllowedSymbols
              ? 'Add at least one allowed symbol before this template can be used in ScoreCheck.'
              : 'ScoreCheck will only allow these configured symbols for this template.'}
          </p>
          {duplicateAllowedCount > 0 && <p className="mt-1 text-[11px] text-red-300">Duplicate allowed symbols detected.</p>}
        </div>

        <div className="mt-4 rounded-md border border-white/8 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-white">Section weights</p>
            <span className={`text-[11px] ${Math.abs(enabledWeightTotal - 100) < 0.001 ? 'text-emerald-300' : 'text-amber-300'}`}>
              Enabled total {enabledWeightTotal.toFixed(2)}
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {sectionOverrides.map((section, index) => (
              <label key={section.sectionKey} className="flex items-center gap-2 rounded-md border border-white/8 p-2 text-xs text-zinc-400">
                <input
                  checked={section.enabled}
                  type="checkbox"
                  onChange={(event) =>
                    setSectionOverrides((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, enabled: event.target.checked } : item,
                      ),
                    )
                  }
                />
                <span className="min-w-0 flex-1 truncate">{section.sectionKey}</span>
                <input
                  className="h-8 w-20 rounded-md border border-white/10 bg-black/30 px-2 text-right text-xs text-white outline-none"
                  min={0}
                  max={100}
                  step={0.01}
                  type="number"
                  value={section.weight}
                  onChange={(event) =>
                    setSectionOverrides((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, weight: Number(event.target.value) } : item,
                      ),
                    )
                  }
                />
              </label>
            ))}
          </div>
        </div>

        <label className="mt-4 block text-xs text-zinc-500">
          Snapshot TTL hours
          <input
            className={`${inputClass} mt-1`}
            min={0}
            max={24}
            type="number"
            value={Number((snapshotPolicy.maxSnapshotAgeSeconds / 3600).toFixed(2))}
            onChange={(event) =>
              setSnapshotPolicy((current) => ({
                ...current,
                maxSnapshotAgeSeconds: Math.round(Number(event.target.value) * 3600),
              }))
            }
          />
        </label>
        <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
          {[
            ['captureMarketRegime', 'Capture market regime'],
            ['captureSectorContext', 'Capture sector context'],
            ['captureRelatedSymbols', 'Capture related symbols'],
            ['captureAllowedTradableSymbol', 'Capture selected tradable symbol'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded-md border border-white/8 p-2">
              <input
                checked={Boolean(snapshotPolicy[key as keyof ScoringTemplateSnapshotPolicy])}
                type="checkbox"
                onChange={(event) =>
                  setSnapshotPolicy((current) => ({
                    ...current,
                    [key]: event.target.checked,
                  }))
                }
              />
              {label}
            </label>
          ))}
        </div>
        <div className="mt-3 space-y-1 text-[11px]">
          {missingMarketIndex && <p className="text-amber-300">Market index is not configured yet.</p>}
          {Math.abs(enabledWeightTotal - 100) > 0.001 && <p className="text-amber-300">Enabled section weights must total 100 before saving.</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button className={buttonClass} disabled={busy} type="button" onClick={onCancel}>Cancel</button>
          <button className={buttonClass} disabled={!canSave} type="submit">
            Save changes
          </button>
        </div>
      </form>
    </div>
  )
}

function SymbolIdChips({
  symbolIds,
  onRemove,
}: {
  symbolIds: string[]
  onRemove: (symbolId: string) => void
}) {
  if (symbolIds.length === 0) {
    return <p className="mt-2 text-[11px] text-zinc-600">No symbols selected</p>
  }
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {symbolIds.map((symbolId) => (
        <button
          key={symbolId}
          className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-zinc-300"
          type="button"
          onClick={() => onRemove(symbolId)}
        >
          {symbolId.slice(-8)} ×
        </button>
      ))}
    </div>
  )
}

function TemplateSymbolField({
  label,
  value,
  onSelect,
}: {
  label: string
  value?: string
  onSelect: (symbol: SymbolSearchResult | null) => void
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-zinc-500">{label}</p>
      <SymbolPicker value={null} onChange={onSelect} />
      {value && <p className="mt-1 truncate text-[11px] text-zinc-600">Current: {value}</p>}
    </div>
  )
}

function ResetRiskLockModal({
  open,
  busy,
  planName,
  onCancel,
  onConfirm,
}: {
  open: boolean
  busy: boolean
  planName: string
  onCancel: () => void
  onConfirm: (input: ResetRiskLockInput) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [resetPlanRiskLock, setResetPlanRiskLock] = useState(true)
  const [resetDailyRisk, setResetDailyRisk] = useState(false)
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <form
        className="w-full max-w-lg rounded-lg border border-red-500/30 bg-zinc-950 p-4 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault()
          void onConfirm({ reason, resetPlanRiskLock, resetDailyRisk }).then(() => setReason(''))
        }}
      >
        <h3 className="text-sm font-semibold text-white">Reset risk lock</h3>
        <p className="mt-2 text-sm leading-5 text-zinc-400">
          This does not delete losses, results, or journals. It only clears the manual risk lock so you can continue testing or trading for {planName}.
        </p>
        <label className="mt-4 block text-xs text-zinc-500">
          Reason
          <textarea
            required
            className="mt-1 h-20 w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-2 text-sm text-white outline-none transition focus:border-cyan-500/60"
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <label className="mt-3 flex items-center gap-2 text-xs text-zinc-300">
          <input checked={resetPlanRiskLock} type="checkbox" onChange={(event) => setResetPlanRiskLock(event.target.checked)} />
          Reset plan risk lock
        </label>
        <label className="mt-2 flex items-center gap-2 text-xs text-zinc-300">
          <input checked={resetDailyRisk} type="checkbox" onChange={(event) => setResetDailyRisk(event.target.checked)} />
          Reset daily risk lock
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button className={buttonClass} disabled={busy} type="button" onClick={onCancel}>Cancel</button>
          <button className={buttonClass} disabled={busy || !reason.trim()} type="submit">Confirm reset</button>
        </div>
      </form>
    </div>
  )
}

function RestartPlanModal({
  open,
  busy,
  plan,
  onCancel,
  onConfirm,
}: {
  open: boolean
  busy: boolean
  plan: TradePlan
  onCancel: () => void
  onConfirm: (input: RestartTradePlanInput) => Promise<void>
}) {
  const [name, setName] = useState(`${plan.name}_restart`)
  const [startingCapital, setStartingCapital] = useState(plan.startingCapital)
  const [archiveOldPlan, setArchiveOldPlan] = useState(true)
  const [activateNewPlan, setActivateNewPlan] = useState(true)
  const [reason, setReason] = useState('')
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <form
        className="w-full max-w-lg rounded-lg border border-white/10 bg-zinc-950 p-4 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault()
          void onConfirm({
            name,
            startingCapital,
            archiveOldPlan,
            activateNewPlan,
            carrySettings: true,
            reason,
          }).then(() => setReason(''))
        }}
      >
        <h3 className="text-sm font-semibold text-white">Restart trade plan</h3>
        <p className="mt-2 text-sm leading-5 text-zinc-400">
          This creates a fresh plan and preserves old trade history. Old results and journals are not deleted.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-zinc-500">
            New plan name
            <input required className="mt-1 h-9 w-full rounded-md border border-white/10 bg-black/30 px-2.5 text-sm text-white outline-none transition focus:border-cyan-500/60" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="text-xs text-zinc-500">
            Starting capital
            <input required min="1" type="number" className="mt-1 h-9 w-full rounded-md border border-white/10 bg-black/30 px-2.5 text-sm text-white outline-none transition focus:border-cyan-500/60" value={startingCapital} onChange={(event) => setStartingCapital(Number(event.target.value))} />
          </label>
        </div>
        <label className="mt-3 block text-xs text-zinc-500">
          Reason
          <textarea
            required
            className="mt-1 h-20 w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-2 text-sm text-white outline-none transition focus:border-cyan-500/60"
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <label className="mt-3 flex items-center gap-2 text-xs text-zinc-300">
          <input checked={archiveOldPlan} type="checkbox" onChange={(event) => setArchiveOldPlan(event.target.checked)} />
          Archive old plan
        </label>
        <label className="mt-2 flex items-center gap-2 text-xs text-zinc-300">
          <input checked={activateNewPlan} type="checkbox" onChange={(event) => setActivateNewPlan(event.target.checked)} />
          Activate new plan
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button className={buttonClass} disabled={busy} type="button" onClick={onCancel}>Cancel</button>
          <button className={buttonClass} disabled={busy || !reason.trim() || !name.trim() || startingCapital <= 0} type="submit">Create restart</button>
        </div>
      </form>
    </div>
  )
}
