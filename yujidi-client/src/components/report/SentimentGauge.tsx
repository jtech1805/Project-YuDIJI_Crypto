type SentimentGaugeProps = {
  value: number
}

export function SentimentGauge({ value }: SentimentGaugeProps) {
  const clamped = Math.max(0, Math.min(100, value))
  const angle = (clamped / 100) * 180
  const x = 110 + 80 * Math.cos(Math.PI - (angle * Math.PI) / 180)
  const y = 110 - 80 * Math.sin(Math.PI - (angle * Math.PI) / 180)

  return (
    <div className="rounded-xl border border-gray-800 bg-[#111111] p-5">
      <h3 className="mb-4 text-lg font-semibold text-purple-300">
        Sentiment Gauge
      </h3>
      <svg viewBox="0 0 220 130" className="h-48 w-full">
        <path
          d="M 30 110 A 80 80 0 0 1 190 110"
          fill="none"
          stroke="#1F2937"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M 30 110 A 80 80 0 0 1 110 30"
          fill="none"
          stroke="#A855F7"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M 110 30 A 80 80 0 0 1 190 110"
          fill="none"
          stroke="#4ADE80"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <line x1="110" y1="110" x2={x} y2={y} stroke="#E5E7EB" strokeWidth="4" />
        <circle cx="110" cy="110" r="6" fill="#E5E7EB" />
        <text
          x="110"
          y="125"
          textAnchor="middle"
          className="fill-gray-200 text-sm font-semibold"
        >
          {clamped}% Positive
        </text>
      </svg>
    </div>
  )
}
