import { BookOpen, Sparkles } from 'lucide-react'
import { useState } from 'react'
import type {
  AiExplanation,
  EntryQuality,
  ExitQuality,
  MistakeTag,
  OutcomeQuality,
  TradeJournal,
  TradeResult,
  UpdateTradeJournalInput,
} from '../../types/trade'
import { buttonClass, EmptyState, inputClass, Section } from './trading-ui'

function formatNumber(value: unknown, digits = 2): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—'
}

export function TradeReviewPanel({
  results,
  journals,
  reviews,
  busy,
  onCreateJournal,
  onUpdateJournal,
  onSaveAndFinalizeJournal,
  onGenerateReview,
}: {
  results: TradeResult[]
  journals: TradeJournal[]
  reviews: Record<string, AiExplanation>
  busy: boolean
  onCreateJournal: (resultId: string) => Promise<void>
  onUpdateJournal: (journalId: string, input: UpdateTradeJournalInput) => Promise<void>
  onSaveAndFinalizeJournal: (journalId: string, input: UpdateTradeJournalInput) => Promise<void>
  onGenerateReview: (journalId: string) => Promise<void>
}) {
  const [drafts, setDrafts] = useState<
    Record<string, {
      userNotes: string
      lessonLearned: string
      selfRating: string
      followedPlan: boolean | null
      entryQuality: EntryQuality | ''
      exitQuality: ExitQuality | ''
      outcomeQuality: OutcomeQuality | ''
      mistakeTag: MistakeTag | ''
    }>
  >({})

  return (
    <Section title="Close And Review">
      {results.length === 0 ? (
        <EmptyState>No closed trade results</EmptyState>
      ) : (
        <div className="space-y-3">
          {results.slice(0, 8).map((result) => {
            const journal = journals.find((item) => item.tradeResultId === result._id)
            const draft = journal
              ? drafts[journal._id] ?? {
                  userNotes: journal.userNotes ?? '',
                  lessonLearned: journal.lessonLearned ?? '',
                  selfRating: journal.selfRating ? String(journal.selfRating) : '',
                  followedPlan: journal.followedPlan ?? null,
                  entryQuality: journal.entryQuality ?? '',
                  exitQuality: journal.exitQuality ?? '',
                  outcomeQuality: journal.outcomeQuality ?? '',
                  mistakeTag: journal.mistakeTags?.[0] ?? '',
                }
              : null
            const review = journal ? reviews[journal._id] : undefined

            return (
              <div key={result._id} className="border border-white/8 bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {result.symbolSnapshot?.displayName ??
                        journal?.symbolSnapshot?.displayName ??
                        'Unknown symbol'}{' '}
                      · {result.resultType}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {formatNumber(result.realizedR)}R · Gross P&amp;L{' '}
                      {formatNumber(result.grossPnl)} · {result.exitReason ?? 'Unknown exit reason'}
                    </p>
                  </div>
                  {!journal && (
                    <button
                      className={buttonClass}
                      disabled={busy}
                      type="button"
                      onClick={() => void onCreateJournal(result._id)}
                    >
                      <BookOpen className="h-4 w-4" />
                      Create journal
                    </button>
                  )}
                </div>

                {journal && draft && (
                  <div className="mt-4 grid gap-3 border-t border-white/8 pt-4 md:grid-cols-2">
                    <div className="border border-white/8 bg-black/20 p-3 md:col-span-2">
                      <p className="text-[10px] font-semibold uppercase text-zinc-600">
                        System facts · read only
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-400 md:grid-cols-4">
                        <span>Direction <b className="block text-zinc-200">{journal.direction}</b></span>
                        <span>Result <b className="block text-zinc-200">{journal.resultType}</b></span>
                        <span>Realized R <b className="block text-zinc-200">{formatNumber(journal.realizedR)}</b></span>
                        <span>Status <b className="block text-zinc-200">{journal.status}</b></span>
                      </div>
                    </div>
                    <p className="text-xs font-semibold uppercase text-zinc-500 md:col-span-2">
                      Your reflection · editable until finalized
                    </p>
                    <textarea
                      className={`${inputClass} min-h-24 py-2`}
                      placeholder="Trade notes"
                      value={draft.userNotes}
                      disabled={journal.status === 'FINALIZED'}
                      onChange={(event) =>
                        setDrafts({
                          ...drafts,
                          [journal._id]: { ...draft, userNotes: event.target.value },
                        })
                      }
                    />
                    <textarea
                      className={`${inputClass} min-h-24 py-2`}
                      placeholder="Lesson learned"
                      value={draft.lessonLearned}
                      disabled={journal.status === 'FINALIZED'}
                      onChange={(event) =>
                        setDrafts({
                          ...drafts,
                          [journal._id]: { ...draft, lessonLearned: event.target.value },
                        })
                      }
                    />
                    <input
                      className={inputClass}
                      type="number"
                      min="1"
                      max="10"
                      placeholder="Self rating 1-10"
                      value={draft.selfRating}
                      disabled={journal.status === 'FINALIZED'}
                      onChange={(event) =>
                        setDrafts({
                          ...drafts,
                          [journal._id]: { ...draft, selfRating: event.target.value },
                        })
                      }
                    />
                    <select
                      className={inputClass}
                      value={
                        draft.followedPlan === null ? '' : draft.followedPlan ? 'YES' : 'NO'
                      }
                      disabled={journal.status === 'FINALIZED'}
                      onChange={(event) =>
                        setDrafts({
                          ...drafts,
                          [journal._id]: {
                            ...draft,
                            followedPlan:
                              event.target.value === ''
                                ? null
                                : event.target.value === 'YES',
                          },
                        })
                      }
                    >
                      <option value="">Did you follow the plan?</option>
                      <option value="YES">Yes</option>
                      <option value="NO">No</option>
                    </select>
                    <select
                      className={inputClass}
                      value={draft.entryQuality}
                      disabled={journal.status === 'FINALIZED'}
                      onChange={(event) =>
                        setDrafts({
                          ...drafts,
                          [journal._id]: {
                            ...draft,
                            entryQuality: event.target.value as EntryQuality,
                          },
                        })
                      }
                    >
                      <option value="">Entry quality</option>
                      {[
                        'VALID_ENTRY',
                        'EARLY_ENTRY',
                        'LATE_ENTRY',
                        'CHASED_ENTRY',
                        'NO_CLEAR_TRIGGER',
                        'ENTERED_AGAINST_PLAN',
                      ].map((value) => <option key={value}>{value}</option>)}
                    </select>
                    <select
                      className={inputClass}
                      value={draft.exitQuality}
                      disabled={journal.status === 'FINALIZED'}
                      onChange={(event) =>
                        setDrafts({
                          ...drafts,
                          [journal._id]: {
                            ...draft,
                            exitQuality: event.target.value as ExitQuality,
                          },
                        })
                      }
                    >
                      <option value="">Exit quality</option>
                      {[
                        'FOLLOWED_STOP',
                        'EXITED_AT_TARGET',
                        'BOOKED_PARTIAL_AS_PLANNED',
                        'EXITED_TOO_EARLY',
                        'EXITED_TOO_LATE',
                        'MOVED_SL_WIDER',
                        'PANIC_EXIT',
                        'NO_EXIT_PLAN',
                      ].map((value) => <option key={value}>{value}</option>)}
                    </select>
                    <select
                      className={inputClass}
                      value={draft.outcomeQuality}
                      disabled={journal.status === 'FINALIZED'}
                      onChange={(event) =>
                        setDrafts({
                          ...drafts,
                          [journal._id]: {
                            ...draft,
                            outcomeQuality: event.target.value as OutcomeQuality,
                          },
                        })
                      }
                    >
                      <option value="">Outcome quality</option>
                      {[
                        'PROFIT_WITH_GOOD_PROCESS',
                        'PROFIT_WITH_BAD_PROCESS',
                        'LOSS_WITH_GOOD_PROCESS',
                        'LOSS_WITH_BAD_PROCESS',
                        'BREAKEVEN_WITH_GOOD_PROCESS',
                        'BREAKEVEN_WITH_BAD_PROCESS',
                      ].map((value) => <option key={value}>{value}</option>)}
                    </select>
                    <select
                      className={inputClass}
                      value={draft.mistakeTag}
                      disabled={journal.status === 'FINALIZED'}
                      onChange={(event) =>
                        setDrafts({
                          ...drafts,
                          [journal._id]: {
                            ...draft,
                            mistakeTag: event.target.value as MistakeTag,
                          },
                        })
                      }
                    >
                      <option value="">Primary mistake tag</option>
                      {[
                        'NONE',
                        'CHASED_ENTRY',
                        'ENTERED_WITHOUT_CONFIRMATION',
                        'IGNORED_MARKET_CONTEXT',
                        'IGNORED_SECTOR_CONTEXT',
                        'POOR_RR',
                        'OVERSIZED_POSITION',
                        'MOVED_SL_WIDER',
                        'AVERAGED_LOSER',
                        'EXITED_TOO_EARLY',
                        'EXITED_TOO_LATE',
                        'REVENGE_TRADE',
                        'OVERTRADED',
                        'BROKE_STOP_TRADING_RULE',
                      ].map((value) => <option key={value}>{value}</option>)}
                    </select>
                    {journal.status !== 'FINALIZED' && (
                      <>
                        <p className="text-[11px] text-zinc-500 md:col-span-2">
                          Required before finalizing: entry quality, exit quality, outcome quality,
                          followed-plan confirmation, and at least one mistake tag. Choose NONE when
                          no mistake applies.
                        </p>
                        <button
                          className={buttonClass}
                          disabled={busy}
                          type="button"
                          onClick={() =>
                            void onUpdateJournal(journal._id, {
                              userNotes: draft.userNotes,
                              lessonLearned: draft.lessonLearned,
                              ...(draft.followedPlan !== null
                                ? { followedPlan: draft.followedPlan }
                                : {}),
                              ...(draft.entryQuality ? { entryQuality: draft.entryQuality } : {}),
                              ...(draft.exitQuality ? { exitQuality: draft.exitQuality } : {}),
                              ...(draft.outcomeQuality ? { outcomeQuality: draft.outcomeQuality } : {}),
                              ...(draft.mistakeTag ? { mistakeTags: [draft.mistakeTag] } : {}),
                              ...(Number(draft.selfRating) >= 1
                                ? { selfRating: Number(draft.selfRating) }
                                : {}),
                            })
                          }
                        >
                          Save journal
                        </button>
                        <button
                          className={buttonClass}
                          disabled={
                            busy ||
                            !draft.entryQuality ||
                            !draft.exitQuality ||
                            !draft.outcomeQuality ||
                            !draft.mistakeTag ||
                            draft.followedPlan === null
                          }
                          type="button"
                          onClick={() =>
                            void onSaveAndFinalizeJournal(journal._id, {
                              userNotes: draft.userNotes,
                              lessonLearned: draft.lessonLearned,
                              followedPlan: draft.followedPlan as boolean,
                              entryQuality: draft.entryQuality as EntryQuality,
                              exitQuality: draft.exitQuality as ExitQuality,
                              outcomeQuality: draft.outcomeQuality as OutcomeQuality,
                              mistakeTags: [draft.mistakeTag as MistakeTag],
                              ...(Number(draft.selfRating) >= 1
                                ? { selfRating: Number(draft.selfRating) }
                                : {}),
                            })
                          }
                        >
                          Save and finalize
                        </button>
                      </>
                    )}
                    {journal.status === 'FINALIZED' && !review && (
                      <button
                        className={`${buttonClass} md:col-span-2`}
                        disabled={busy}
                        type="button"
                        onClick={() => void onGenerateReview(journal._id)}
                      >
                        <Sparkles className="h-4 w-4" />
                        Generate coaching review
                      </button>
                    )}
                    {review && (
                      <div className="border border-cyan-500/20 bg-cyan-500/5 p-4 md:col-span-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-cyan-200">AI coaching review</p>
                          <span className="text-[10px] uppercase text-zinc-500">
                            {review.status.includes('FALLBACK') || review.fallbackOutput
                              ? 'Safe fallback review'
                              : review.status}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-zinc-300">
                          {review.summary ?? 'Coaching review generated without a summary.'}
                        </p>
                        <p className="mt-2 text-[11px] text-zinc-500">
                          AI does not change your result or risk state.
                        </p>
                        {(review.improvementSuggestions?.length ?? 0) > 0 && (
                          <ul className="mt-3 space-y-1 text-xs text-zinc-400">
                            {review.improvementSuggestions?.map((suggestion) => (
                              <li key={suggestion}>• {suggestion}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}
