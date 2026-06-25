import { AxiosError } from 'axios'
import { RefreshCw, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  closeActiveTrade,
  evaluateActiveTrade,
  listActiveTrades,
} from '../api/activeTrades'
import { createScoreCheck, convertScoreCheck, listScoreChecks } from '../api/scoreChecks'
import { listTradeEvents } from '../api/tradeEvents'
import {
  generateAiReview,
  listTradeJournals,
  finalizeTradeJournal,
  updateTradeJournal,
} from '../api/tradeJournals'
import { activateTradePlan, createTradePlan, listTradePlans } from '../api/tradePlans'
import { createTradeJournal, listTradeResults } from '../api/tradeResults'
import {
  cancelTradeSetup,
  confirmActualTrade,
  listTradeSetups,
} from '../api/tradeSetups'
import { ActiveTradePanel } from '../components/trading/ActiveTradePanel'
import { ScoreCheckPanel } from '../components/trading/ScoreCheckPanel'
import { TradePlanPanel } from '../components/trading/TradePlanPanel'
import { TradeReviewPanel } from '../components/trading/TradeReviewPanel'
import { TradeSetupPanel } from '../components/trading/TradeSetupPanel'
import { buttonClass } from '../components/trading/trading-ui'
import { WorkflowStepper } from '../components/trading/WorkflowStepper'
import { useAuth } from '../context/AuthContext'
import { useWebSocket } from '../context/WebSocketContext'
import type {
  ActiveTrade,
  AiExplanation,
  CloseActiveTradeInput,
  ConfirmActualTradeInput,
  CreateScoreCheckInput,
  CreateTradePlanInput,
  ScoreCheck,
  TradeJournal,
  TradePlan,
  TradeResult,
  TradeSetup,
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
  const [setups, setSetups] = useState<TradeSetup[]>([])
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([])
  const [results, setResults] = useState<TradeResult[]>([])
  const [journals, setJournals] = useState<TradeJournal[]>([])
  const [reviews, setReviews] = useState<Record<string, AiExplanation>>({})
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
      const [
        nextPlans,
        nextScoreChecks,
        nextSetups,
        nextTrades,
        nextEvents,
        nextResults,
        nextJournals,
      ] = await Promise.all([
        listTradePlans(),
        listScoreChecks(),
        listTradeSetups(),
        listActiveTrades(),
        listTradeEvents(),
        listTradeResults(),
        listTradeJournals(),
      ])
      setPlans(nextPlans)
      setScoreChecks(nextScoreChecks)
      setSetups(nextSetups)
      setActiveTrades(nextTrades)
      setInitialTradeEvents(nextEvents)
      setResults(nextResults)
      setJournals(nextJournals)
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

  useEffect(() => {
    void loadWorkflow()
  }, [loadWorkflow])

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

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
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
          />
          <ScoreCheckPanel
            scoreChecks={scoreChecks}
            selectedPlan={selectedPlan}
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
                setScoreChecks((current) =>
                  current.map((check) =>
                    check._id === scoreCheckId
                      ? { ...check, convertedToTradeSetupId: setup._id }
                      : check,
                  ),
                )
              })
            }
          />
          <TradeSetupPanel
            setups={setups}
            busy={busy}
            onConfirm={async (id: string, input: ConfirmActualTradeInput) =>
              run(async () => {
                const trade = await confirmActualTrade(id, input)
                setActiveTrades((current) => [trade, ...current])
                setSetups((current) =>
                  current.map((setup) =>
                    setup._id === id ? { ...setup, status: 'EXECUTED' } : setup,
                  ),
                )
              })
            }
            onCancel={async (id) =>
              run(async () => {
                const setup = await cancelTradeSetup(id)
                setSetups((current) => current.map((item) => (item._id === id ? setup : item)))
              })
            }
          />
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
              })
            }
          />
          <TradeReviewPanel
            results={results}
            journals={journals}
            reviews={reviews}
            busy={busy}
            onCreateJournal={async (resultId) =>
              run(async () => {
                const journal = await createTradeJournal(resultId)
                setJournals((current) => [journal, ...current])
              })
            }
            onUpdateJournal={async (journalId: string, input: UpdateTradeJournalInput) =>
              run(async () => {
                const journal = await updateTradeJournal(journalId, input)
                setJournals((current) =>
                  current.map((item) => (item._id === journalId ? journal : item)),
                )
              })
            }
            onSaveAndFinalizeJournal={async (journalId, input) =>
              run(async () => {
                await updateTradeJournal(journalId, input)
                const journal = await finalizeTradeJournal(journalId)
                setJournals((current) =>
                  current.map((item) => (item._id === journalId ? journal : item)),
                )
              })
            }
            onGenerateReview={async (journalId) =>
              run(async () => {
                const review = await generateAiReview(journalId)
                setReviews((current) => ({ ...current, [journalId]: review }))
              })
            }
          />
        </>
      )}
    </div>
  )
}
