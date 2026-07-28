import { Loader2, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { SymbolSearchResult } from '../../api/symbols'
import { useSymbolSearch } from '../../hooks/useSymbolSearch'
import { inputClass } from './trading-ui'

const filterPresets = [
  { id: 'ALL', label: 'All', filters: {} },
  { id: 'CRYPTO', label: 'Crypto', filters: { provider: 'BINANCE', marketType: 'CRYPTO' } },
  { id: 'NSE_CASH', label: 'India Cash', filters: { provider: 'ANGEL_ONE', marketType: 'EQUITY', exchange: 'NSE', instrumentType: 'CASH' } },
  { id: 'NFO_FUTURE', label: 'India Futures', filters: { provider: 'ANGEL_ONE', marketType: 'FNO', exchange: 'NFO', instrumentType: 'FUTURE' } },
  { id: 'NFO_OPTION', label: 'India Options', filters: { provider: 'ANGEL_ONE', marketType: 'FNO', exchange: 'NFO', instrumentType: 'OPTION' } },
  { id: 'MCX', label: 'MCX', filters: { provider: 'ANGEL_ONE', marketType: 'COMMODITY', exchange: 'MCX' } },
] as const

const formatExpiry = (expiry?: string) => {
  if (!expiry) return ''
  const date = new Date(expiry)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()
}

export function SymbolPicker({
  value,
  onChange,
  allowedSymbolIds,
  helperText,
}: {
  value: SymbolSearchResult | null
  onChange: (symbol: SymbolSearchResult | null) => void
  allowedSymbolIds?: string[]
  helperText?: string
}) {
  const [query, setQuery] = useState(value?.displayName ?? '')
  const [isOpen, setIsOpen] = useState(false)
  const [presetId, setPresetId] = useState<(typeof filterPresets)[number]['id']>('ALL')
  const blurTimerRef = useRef<number | undefined>(undefined)
  const activePreset = filterPresets.find((preset) => preset.id === presetId) ?? filterPresets[0]
  const { results, isLoading, error } = useSymbolSearch(query, { ...activePreset.filters, limit: 12 })
  const allowedSet = allowedSymbolIds?.length ? new Set(allowedSymbolIds) : null
  const visibleResults = allowedSet ? results.filter((symbol) => allowedSet.has(symbol.symbolId)) : results
  const showResults = isOpen && query.trim().length >= 2

  useEffect(() => {
    setQuery(value?.displayName ?? '')
  }, [value?.displayName])

  useEffect(() => {
    return () => {
      if (blurTimerRef.current !== undefined) window.clearTimeout(blurTimerRef.current)
    }
  }, [])

  return (
    <div
      className="relative space-y-2"
      onBlur={() => {
        blurTimerRef.current = window.setTimeout(() => setIsOpen(false), 120)
      }}
      onFocus={() => {
        if (blurTimerRef.current !== undefined) window.clearTimeout(blurTimerRef.current)
        if (query.trim().length >= 2) setIsOpen(true)
      }}
    >
      <div className="flex gap-1 overflow-x-auto">
        {filterPresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`h-7 shrink-0 rounded-md border px-2 text-[11px] transition ${
              presetId === preset.id
                ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100'
                : 'border-white/10 bg-white/[0.03] text-zinc-500 hover:text-zinc-200'
            }`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setPresetId(preset.id)
              if (query.trim().length >= 2) setIsOpen(true)
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="relative">
      <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
      <input
        className={`${inputClass} pl-9`}
        placeholder="Search market symbol"
        value={query}
        onFocus={() => {
          if (query.trim().length >= 2) setIsOpen(true)
        }}
        onChange={(event) => {
          setQuery(event.target.value)
          setIsOpen(event.target.value.trim().length >= 2)
          onChange(null)
        }}
      />
      {showResults && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-white/10 bg-zinc-950 shadow-2xl">
          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Searching
            </div>
          )}
          {!isLoading && error && <div className="px-3 py-3 text-xs text-red-300">{error}</div>}
          {!isLoading && !error && visibleResults.length === 0 && (
            <div className="px-3 py-3 text-xs text-zinc-500">No symbols found</div>
          )}
          {!isLoading &&
            visibleResults.map((symbol) => (
              <button
                type="button"
                key={symbol.symbolId}
                className="block w-full border-b border-white/5 px-3 py-2 text-left last:border-0 hover:bg-white/5"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(symbol)
                  setQuery(symbol.displayName || symbol.symbol)
                  setIsOpen(false)
                }}
              >
                <span className="block text-sm text-zinc-100">{symbol.displayName || symbol.symbol}</span>
                <span className="flex flex-wrap gap-1 text-[11px] text-zinc-500">
                  <span>{symbol.provider}</span>
                  <span>· {symbol.exchange}</span>
                  <span>· {symbol.instrumentType}</span>
                  {symbol.expiry && <span>· {formatExpiry(symbol.expiry)}</span>}
                  {symbol.strikePrice && <span>· {symbol.strikePrice}</span>}
                  {symbol.optionType && <span>· {symbol.optionType}</span>}
                  {symbol.requiresBrokerLogin && <span>· Broker login</span>}
                </span>
              </button>
            ))}
        </div>
      )}
      </div>
      {helperText && <p className="text-[11px] text-amber-300">{helperText}</p>}
    </div>
  )
}
