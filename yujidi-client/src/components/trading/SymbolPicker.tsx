import { Loader2, Search } from 'lucide-react'
import { useState } from 'react'
import type { SymbolSearchResult } from '../../api/symbols'
import { useSymbolSearch } from '../../hooks/useSymbolSearch'
import { inputClass } from './trading-ui'

export function SymbolPicker({
  value,
  onChange,
}: {
  value: SymbolSearchResult | null
  onChange: (symbol: SymbolSearchResult | null) => void
}) {
  const [query, setQuery] = useState(value?.displayName ?? '')
  const { results, isLoading, error } = useSymbolSearch(query, { limit: 12 })

  return (
    <div className="relative">
      <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
      <input
        className={`${inputClass} pl-9`}
        placeholder="Search market symbol"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          onChange(null)
        }}
      />
      {query.trim().length >= 2 && !value && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto border border-white/10 bg-zinc-950 shadow-2xl">
          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Searching
            </div>
          )}
          {!isLoading && error && <div className="px-3 py-3 text-xs text-red-300">{error}</div>}
          {!isLoading && !error && results.length === 0 && (
            <div className="px-3 py-3 text-xs text-zinc-500">No symbols found</div>
          )}
          {!isLoading &&
            results.map((symbol) => (
              <button
                type="button"
                key={symbol.symbolId}
                className="block w-full border-b border-white/5 px-3 py-2 text-left last:border-0 hover:bg-white/5"
                onClick={() => {
                  onChange(symbol)
                  setQuery(symbol.displayName || symbol.symbol)
                }}
              >
                <span className="block text-sm text-zinc-100">{symbol.displayName || symbol.symbol}</span>
                <span className="text-[11px] text-zinc-500">
                  {symbol.provider} · {symbol.exchange} · {symbol.instrumentType}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
