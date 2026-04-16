import { motion, AnimatePresence } from 'framer-motion'
import type { Alert } from '../../context/WebSocketContext'

export function AlertFeed({ alerts }: { alerts: Alert[] }) {
  return (
    <section className="rounded-xl border border-gray-800 bg-[#111111] p-5">
      <h2 className="mb-4 text-lg font-semibold text-purple-300">Alert Feed</h2>
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {alerts.map((alert) => (
            <motion.article
              key={alert.id}
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.22 }}
              className="rounded-lg border border-gray-800 bg-[#0A0A0A] p-4"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium text-green-300">{alert.symbol}</span>
                <span className="text-xs text-gray-400">{alert.createdAt}</span>
              </div>
              <p className="text-sm text-gray-200">{alert.message}</p>
              <span className="mt-2 inline-flex rounded-full border border-purple-500/50 px-2 py-0.5 text-xs text-purple-300">
                {alert.severity.toUpperCase()}
              </span>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </section>
  )
}
