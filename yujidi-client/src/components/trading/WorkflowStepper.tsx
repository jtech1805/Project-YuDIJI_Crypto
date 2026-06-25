import { Check, LockKeyhole } from 'lucide-react'

export type WorkflowStep = {
  label: string
  complete: boolean
  nextAction: string
}

export function WorkflowStepper({ steps }: { steps: WorkflowStep[] }) {
  const currentIndex = steps.findIndex((step) => !step.complete)

  return (
    <div className="mb-6 overflow-x-auto border-y border-white/8 py-3">
      <div className="grid min-w-[920px] grid-cols-8 gap-2">
        {steps.map((step, index) => {
          const state = step.complete ? 'completed' : index === currentIndex ? 'current' : 'blocked'
          return (
            <div
              key={step.label}
              className={`min-h-20 border px-3 py-2 ${
                state === 'completed'
                  ? 'border-emerald-500/25 bg-emerald-500/5'
                  : state === 'current'
                    ? 'border-cyan-500/40 bg-cyan-500/8'
                    : 'border-white/6 bg-white/[0.01]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-zinc-200">{step.label}</span>
                {state === 'completed' ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : state === 'blocked' ? (
                  <LockKeyhole className="h-3.5 w-3.5 text-zinc-600" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                )}
              </div>
              <p className="mt-2 text-[10px] uppercase text-zinc-600">{state}</p>
              <p className="mt-1 text-[11px] leading-4 text-zinc-500">{step.nextAction}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
