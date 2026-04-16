type MonitorCardProps = {
  symbol: string
  price: string
  sparkline: number[]
}

function makeSparklinePath(points: number[]) {
  const width = 120
  const height = 40
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = Math.max(max - min, 1)

  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width
      const y = height - ((point - min) / range) * height
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

export function MonitorCard({ symbol, price, sparkline }: MonitorCardProps) {
  return (
    <article className="min-w-64 rounded-xl border border-gray-800 bg-[#111111] p-4 shadow-[0_0_24px_rgba(168,85,247,0.06)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide text-purple-300">
          {symbol}
        </h3>
        <span className="text-sm font-medium text-green-300">{price}</span>
      </div>
      <svg viewBox="0 0 120 40" className="h-12 w-full">
        <path
          d={makeSparklinePath(sparkline)}
          fill="none"
          stroke="#4ADE80"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </article>
  )
}
