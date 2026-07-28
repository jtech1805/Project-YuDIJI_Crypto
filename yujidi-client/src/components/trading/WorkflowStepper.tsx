import { Check, CircleDot, LockKeyhole } from 'lucide-react'

export type WorkflowStep = {
  label: string
  complete: boolean
  nextAction: string
}

export function WorkflowStepper({ steps }: { steps: WorkflowStep[] }) {
  const currentIndex = steps.findIndex((step) => !step.complete)

  return (
    <div className="mb-4 overflow-x-auto border-y border-white/8 py-2">
      <div className="grid min-w-[920px] grid-cols-8 gap-2">
        {steps.map((step, index) => {
          const state = step.complete ? 'completed' : index === currentIndex ? 'current' : 'blocked'
          return (
            <div
              key={step.label}
              className={`min-h-16 rounded-lg border px-2.5 py-2 ${
                state === 'completed'
                  ? 'border-emerald-500/25 bg-emerald-500/5'
                  : state === 'current'
                    ? 'border-cyan-500/40 bg-cyan-500/8 shadow-[0_0_18px_rgba(34,211,238,0.08)]'
                    : 'border-white/6 bg-white/[0.01]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold text-zinc-200">{step.label}</span>
                {state === 'completed' ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : state === 'blocked' ? (
                  <LockKeyhole className="h-3.5 w-3.5 text-zinc-600" />
                ) : (
                  <CircleDot className="h-3.5 w-3.5 animate-pulse text-cyan-300" />
                )}
              </div>
              <p className="mt-1 text-[10px] uppercase text-zinc-600">{state}</p>
              <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500">{step.nextAction}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
