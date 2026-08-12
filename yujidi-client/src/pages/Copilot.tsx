import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AxiosError } from 'axios'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CircleAlert,
  Pencil,
  Sparkles,
} from 'lucide-react'

import {
  createCopilotTemplateDraft,
  acceptCopilotTemplateDraft,
  getCopilotErrorMessage,
  type CopilotDraftPreview,
  type CopilotTemplateDraftResponse,
} from '../api/copilot'
import { listScoringTemplates } from '../api/scoringTemplates'
import type { ScoringTemplateSummary } from '../types/trade'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'

const MAX_PROMPT_LENGTH = 4000
const EXAMPLES = [
  'Create a BTC strategy using ETF net flow',
  'Create a Bitcoin strategy using ETF inflow',
  'Create a Tata Steel strategy using broker research',
] as const

type VisibleResult = Exclude<CopilotTemplateDraftResponse, { status: 'unavailable' }> | null

export function Copilot() {
  const [prompt, setPrompt] = useState('')
  const [originalPrompt, setOriginalPrompt] = useState('')
  const [clarificationAnswer, setClarificationAnswer] = useState('')
  const [result, setResult] = useState<VisibleResult>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [systemTemplates, setSystemTemplates] = useState<ScoringTemplateSummary[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    void listScoringTemplates()
      .then((templates) => active && setSystemTemplates(templates.filter(({ scope }) => scope === 'SYSTEM')))
      .catch(() => active && setError('Approved base templates are temporarily unavailable.'))
    return () => { active = false }
  }, [])

  const submit = async (submittedPrompt: string) => {
    if (!submittedPrompt.trim() || isLoading) return

    setIsLoading(true)
    setError(null)
    try {
      const response = await createCopilotTemplateDraft(submittedPrompt.trim())
      if (response.status === 'unavailable') {
        setResult(null)
        setError(
          response.code === 'REQUEST_TIMEOUT'
            ? 'This request took too long. Try again with a simpler request.'
            : response.code === 'INVALID_REQUEST'
              ? 'Please review your request and try again.'
              : 'Copilot is currently unavailable.',
        )
        return
      }
      setResult(response)
      setClarificationAnswer('')
    } catch (requestError) {
      setResult(null)
      setError(getCopilotErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateDraft = () => {
    const value = prompt.trim()
    if (!value) return
    setOriginalPrompt(value)
    void submit(value)
  }

  const handleClarification = () => {
    const answer = clarificationAnswer.trim()
    if (!answer) return
    const basePrompt = originalPrompt || prompt.trim()
    void submit(`${basePrompt}\n\nClarification:\nThe user answered: ${answer}`)
  }

  const editPrompt = () => {
    setPrompt(originalPrompt || prompt)
    setResult(null)
    setError(null)
    setClarificationAnswer('')
  }

  const startOver = () => {
    setPrompt('')
    setOriginalPrompt('')
    setResult(null)
    setError(null)
    setClarificationAnswer('')
  }

  return (
    <section className="mx-auto w-full max-w-3xl py-4 sm:py-8">
      <header className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          YUDIJI Copilot
        </p>
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
          Describe the scoring template you want
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          Copilot will prepare a safe preview using factors supported by YUDIJI. You stay in
          control of weights and saving.
        </p>
      </header>

      <div className="glass-card overflow-hidden p-5 sm:p-7">
        {isLoading ? (
          <LoadingState />
        ) : result?.status === 'success' ? (
          <DraftReview
            result={result}
            systemTemplates={systemTemplates}
            onEdit={editPrompt}
            onSaved={(templateId) => {
              startOver()
              navigate('/trading-workflow', { state: { acceptedTemplateId: templateId } })
            }}
          />
        ) : result?.status === 'unsupported' ? (
          <UnsupportedPreview draft={result.draft} onEdit={editPrompt} />
        ) : result?.status === 'needs_clarification' ? (
          <ClarificationForm
            questions={result.questions}
            answer={clarificationAnswer}
            onAnswerChange={setClarificationAnswer}
            onContinue={handleClarification}
            onEdit={editPrompt}
          />
        ) : (
          <PromptForm
            prompt={prompt}
            error={error}
            onPromptChange={setPrompt}
            onSubmit={handleCreateDraft}
          />
        )}
      </div>
    </section>
  )
}

function PromptForm({
  prompt,
  error,
  onPromptChange,
  onSubmit,
}: {
  prompt: string
  error: string | null
  onPromptChange: (value: string) => void
  onSubmit: () => void
}) {
  const showCounter = prompt.length >= MAX_PROMPT_LENGTH * 0.75

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <label htmlFor="copilot-prompt" className="mb-3 block text-sm font-medium text-foreground">
        What kind of scoring template do you need?
      </label>
      <textarea
        id="copilot-prompt"
        value={prompt}
        maxLength={MAX_PROMPT_LENGTH}
        rows={6}
        onChange={(event) => onPromptChange(event.target.value)}
        placeholder="Create a BTC strategy using ETF net flow..."
        className="w-full resize-y rounded-xl border border-input bg-background/70 px-4 py-3 text-base leading-6 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
      />
      <div className="mt-2 flex min-h-5 justify-end text-xs text-muted-foreground">
        {showCounter && <span>{prompt.length.toLocaleString()} / {MAX_PROMPT_LENGTH.toLocaleString()}</span>}
      </div>

      {error && (
        <div role="alert" className="mt-3 flex gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" size="lg" className="mt-5 w-full" disabled={!prompt.trim()}>
        <Sparkles />
        Create Draft
      </Button>

      <div className="mt-7 border-t border-border pt-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Try an example
        </p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onPromptChange(example)}
              className="rounded-full border border-border bg-secondary/40 px-3 py-2 text-left text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </form>
  )
}

function LoadingState() {
  return (
    <div role="status" className="flex min-h-72 flex-col items-center justify-center text-center">
      <div className="mb-5 flex h-12 w-12 animate-pulse items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold">Preparing your draft...</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        This can take several seconds while Copilot checks supported YUDIJI knowledge.
      </p>
    </div>
  )
}

function DraftReview({
  result,
  systemTemplates,
  onEdit,
  onSaved,
}: {
  result: Extract<CopilotTemplateDraftResponse, { status: 'success' }>
  systemTemplates: ScoringTemplateSummary[]
  onEdit: () => void
  onSaved: (templateId: string) => void
}) {
  const { draft, review } = result
  const [templateName, setTemplateName] = useState(draft.title || 'Copilot scoring template')
  const [description, setDescription] = useState(draft.description || '')
  const [baseTemplateKey, setBaseTemplateKey] = useState('')
  const [weights, setWeights] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const selectedBase = systemTemplates.find(({ templateKey }) => templateKey === baseTemplateKey)
  const numericWeights = draft.bindings.map(({ bindingReviewId }) => Number(weights[bindingReviewId]))
  const allWeightsValid = numericWeights.length > 0 && numericWeights.every(
    (weight, index) => weights[draft.bindings[index]!.bindingReviewId]?.trim() && Number.isFinite(weight) && weight >= 0 && weight <= 100,
  )
  const totalWeight = allWeightsValid ? numericWeights.reduce((total, weight) => total + weight, 0) : numericWeights.filter(Number.isFinite).reduce((total, weight) => total + weight, 0)
  const canSave = Boolean(
    selectedBase && templateName.trim() && allWeightsValid && totalWeight === 100 && draft.unresolvedConcepts.length === 0,
  )

  const save = async () => {
    if (!canSave || !selectedBase || isSaving) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const response = await acceptCopilotTemplateDraft(review.reviewId, {
        reviewVersion: review.reviewVersion,
        template: {
          baseTemplateKey: selectedBase.templateKey,
          templateName: templateName.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          marketType: selectedBase.marketType,
          tradeStyle: selectedBase.tradeStyle,
          instrumentType: selectedBase.instrumentType,
        },
        acceptedBindings: draft.bindings.map(({ bindingReviewId }) => ({
          bindingReviewId,
          weight: Number(weights[bindingReviewId]),
        })),
      })
      if (response.status === 'created') {
        onSaved(response.template.id)
        return
      }
      if (response.code === 'REVIEW_ALREADY_ACCEPTED' && response.template?.id) {
        onSaved(response.template.id)
        return
      }
      setSaveError(acceptanceMessage(response.code))
    } catch (requestError) {
      const rejected = requestError instanceof AxiosError ? requestError.response?.data as { code?: string } | undefined : undefined
      setSaveError(rejected?.code ? acceptanceMessage(rejected.code) : 'We couldn’t save this draft. Your preview is still available.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            Review Draft
          </span>
          <h2 className="mt-4 text-2xl font-semibold">{draft.title || 'Your scoring template draft'}</h2>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bull/10 text-bull">
          <Check className="h-5 w-5" />
        </div>
      </div>

      <Subject subject={draft.subject} />
      <label className="mt-6 block text-sm font-medium">Template name
        <Input className="mt-2" maxLength={120} value={templateName} onChange={(event) => setTemplateName(event.target.value)} disabled={isSaving} />
      </label>
      <label className="mt-4 block text-sm font-medium">Description
        <textarea className="mt-2 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} disabled={isSaving} />
      </label>
      <label className="mt-4 block text-sm font-medium">Approved base template
        <select className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={baseTemplateKey} onChange={(event) => setBaseTemplateKey(event.target.value)} disabled={isSaving}>
          <option value="">Select a base template</option>
          {systemTemplates.map((template) => <option key={template.templateKey} value={template.templateKey}>{template.templateName} · {template.marketType} · {template.tradeStyle}</option>)}
        </select>
      </label>

      <div className="mt-6 space-y-3">
        <h3 className="text-sm font-medium">Factor weights</h3>
        {draft.bindings.map((binding) => (
          <div key={binding.bindingReviewId} className="grid gap-3 rounded-lg border border-border bg-secondary/20 p-4 sm:grid-cols-[1fr_8rem] sm:items-end">
            <div><p className="font-medium">{binding.label}</p><p className="mt-1 text-xs text-muted-foreground">Relationship: {binding.relationship}</p></div>
            <label className="text-xs text-muted-foreground">Weight %
              <Input type="number" min="0" max="100" step="any" value={weights[binding.bindingReviewId] ?? ''} onChange={(event) => setWeights((current) => ({ ...current, [binding.bindingReviewId]: event.target.value }))} disabled={isSaving} />
            </label>
          </div>
        ))}
        <div className="flex justify-between rounded-lg border border-border px-4 py-3 text-sm"><span>Total</span><span className={totalWeight === 100 ? 'text-bull' : 'text-amber-300'}>{totalWeight}%</span></div>
        {(!allWeightsValid || totalWeight !== 100) && <p className="text-sm text-amber-200">Weights must be between 0 and 100 and total exactly 100%.</p>}
      </div>

      {draft.unresolvedConcepts.length > 0 && (
        <div className="mt-6 rounded-lg border border-amber-400/20 bg-amber-400/5 p-4">
          <p className="text-sm font-medium text-amber-200">Some concepts are not supported yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {draft.unresolvedConcepts.map((concept) => concept.label).join(', ')}
          </p>
        </div>
      )}

      {saveError && <div role="alert" className="mt-5 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm">{saveError}</div>}
      <p className="mt-5 text-xs text-muted-foreground">This review expires at {new Date(review.expiresAt).toLocaleTimeString()}.</p>
      <div className="mt-7 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={onEdit} disabled={isSaving}><Pencil /> Edit Prompt</Button>
        <Button type="button" onClick={() => void save()} disabled={!canSave || isSaving}>{isSaving ? 'Saving draft...' : 'Save as Draft'}</Button>
      </div>
    </div>
  )
}

function acceptanceMessage(code: string): string {
  if (code === 'REVIEW_EXPIRED' || code === 'REVIEW_NOT_FOUND') return 'This Copilot preview expired. Generate it again before saving.'
  if (code === 'INVALID_WEIGHT') return 'Weights must total 100%.'
  if (code === 'STALE_GENERATION') return 'This draft is no longer compatible with the latest template rules. Generate it again.'
  if (code === 'UNRESOLVED_CONCEPTS_PRESENT') return 'Resolve unsupported concepts by editing your prompt before saving.'
  if (code === 'REVIEW_ALREADY_ACCEPTED') return 'This draft was already saved.'
  return 'We couldn’t save this draft. Your preview is still available.'
}

function UnsupportedPreview({ draft, onEdit }: { draft: CopilotDraftPreview; onEdit: () => void }) {
  return (
    <div>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/10 text-amber-300">
        <CircleAlert className="h-5 w-5" />
      </div>
      <h2 className="mt-5 text-xl font-semibold">Some parts aren&apos;t supported yet</h2>
      <div className="mt-5"><Subject subject={draft.subject} /></div>
      <h3 className="mb-3 mt-6 text-sm font-medium">Unsupported concepts</h3>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {draft.unresolvedConcepts.map((concept) => <li key={concept.conceptId}>• {concept.label}</li>)}
      </ul>
      <p className="mt-6 rounded-lg border border-border bg-secondary/30 p-4 text-sm leading-6 text-muted-foreground">
        YUDIJI won&apos;t silently replace unsupported concepts with a different factor.
      </p>
      <Button type="button" variant="outline" className="mt-6 w-full sm:w-auto" onClick={onEdit}>
        <ArrowLeft />
        Change Prompt
      </Button>
    </div>
  )
}

function ClarificationForm({
  questions,
  answer,
  onAnswerChange,
  onContinue,
  onEdit,
}: {
  questions: string[]
  answer: string
  onAnswerChange: (value: string) => void
  onContinue: () => void
  onEdit: () => void
}) {
  return (
    <form onSubmit={(event) => { event.preventDefault(); onContinue() }}>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-5 w-5" />
      </div>
      <h2 className="mt-5 text-xl font-semibold">I need one detail</h2>
      <div className="mt-4 space-y-3">
        {questions.map((question) => <p key={question} className="leading-7 text-muted-foreground">{question}</p>)}
      </div>
      <label htmlFor="clarification-answer" className="mb-2 mt-6 block text-sm font-medium">
        Your answer
      </label>
      <Input
        id="clarification-answer"
        value={answer}
        maxLength={MAX_PROMPT_LENGTH}
        onChange={(event) => onAnswerChange(event.target.value)}
        placeholder="For example: broader market"
        autoFocus
      />
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onEdit}><Pencil /> Edit prompt</Button>
        <Button type="submit" disabled={!answer.trim()}>Continue</Button>
      </div>
    </form>
  )
}

function Subject({ subject }: { subject: CopilotDraftPreview['subject'] }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Subject</p>
      <p className="mt-1 font-medium">
        {subject.displayName || subject.key}
        {subject.displayName && subject.displayName !== subject.key && (
          <span className="text-muted-foreground"> · {subject.key}</span>
        )}
      </p>
    </div>
  )
}
