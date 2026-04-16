import { SentimentGauge } from '../components/report/SentimentGauge'

const analysisPoints = [
  'Elevated exchange inflows from large wallets suggest short-term distribution pressure.',
  'Derivatives open interest is increasing faster than spot volume, raising liquidation risk.',
  'Macro headlines are neutral, but social sentiment has turned defensive over the last 90 minutes.',
]

const recommendedActions = [
  'Reduce leverage exposure on high-beta assets until volatility normalizes.',
  'Enable tighter stop-loss bands for all swing positions in monitored pairs.',
  'Increase stablecoin allocation by 10-15% for tactical redeployment.',
]

export function DetailedReport() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-gray-800 bg-[#111111] p-6">
        <h1 className="mb-4 text-2xl font-semibold text-purple-300">
          AI Text Analysis
        </h1>
        <ul className="list-disc space-y-3 pl-5 text-gray-200">
          {analysisPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>

      <SentimentGauge value={72} />

      <section className="rounded-xl border border-gray-800 bg-[#111111] p-6 lg:col-span-2">
        <h2 className="mb-4 text-xl font-semibold text-green-300">
          Recommended Business Actions
        </h2>
        <ul className="space-y-3">
          {recommendedActions.map((action) => (
            <li
              key={action}
              className="rounded-lg border border-gray-800 bg-[#0A0A0A] px-4 py-3 text-gray-200"
            >
              {action}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
