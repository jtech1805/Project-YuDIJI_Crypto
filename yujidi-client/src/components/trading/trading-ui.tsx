import type { ReactNode } from 'react'
import type { TradePermission } from '../../types/trade'

export const inputClass =
  'h-10 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-cyan-500/60'

export const buttonClass =
  'inline-flex h-9 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-sm font-medium text-zinc-200 transition hover:border-cyan-500/40 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-40'

export function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="border-t border-white/8 py-6 first:border-t-0 first:pt-0">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

const permissionStyles: Record<TradePermission, string> = {
  TAKE_TRADE: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  TAKE_SMALL_RISK: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  WAIT: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  REJECT: 'border-red-500/30 bg-red-500/10 text-red-300',
  STOP_TRADING: 'border-red-700/50 bg-red-950/50 text-red-200',
}

const permissionHelp: Record<TradePermission, string> = {
  TAKE_TRADE: 'Risk rules currently allow this planned trade.',
  TAKE_SMALL_RISK: 'Allowed only with reduced/manual caution.',
  WAIT: 'Setup is not ready for managed execution.',
  REJECT: 'Risk/scoring rules rejected this setup.',
  STOP_TRADING: 'Risk rules block new trades.',
}

export function PermissionBadge({
  permission,
  showHelp = true,
}: {
  permission: TradePermission
  showHelp?: boolean
}) {
  return (
    <div className="max-w-xs">
      <span className={`inline-flex rounded border px-2 py-1 text-[11px] font-semibold ${permissionStyles[permission]}`}>
        {permission.replaceAll('_', ' ')}
      </span>
      {showHelp && <p className="mt-1 text-[11px] leading-4 text-zinc-500">{permissionHelp[permission]}</p>}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-500">
      {children}
    </div>
  )
}
