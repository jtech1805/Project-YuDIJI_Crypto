import { AnimatePresence } from 'framer-motion'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { PageTransition } from './components/layout/PageTransition'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import { Dashboard } from './pages/Dashboard'
import { DetailedReport } from './pages/DetailedReport'
// import { Login } from './pages/Login'
import { SetupMonitor } from './pages/SetupMonitor'
import LandingPage from './pages/LandingPage'
import Engine from './pages/Engine'

function AnimatedRoutes() {
  const location = useLocation()
  const { user } = useAuth()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* <Route path="/login" element={<Login />} /> */}
        <Route path="/login" element={<LandingPage />} />
        <Route path="/engine" element={<Engine />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AppShell>
                <PageTransition>
                  <Dashboard />
                </PageTransition>
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/setup-monitor"
          element={
            <ProtectedRoute>
              <AppShell>
                <PageTransition>
                  <SetupMonitor />
                </PageTransition>
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="/report"
          element={
            <ProtectedRoute>
              <AppShell>
                <PageTransition>
                  <DetailedReport />
                </PageTransition>
              </AppShell>
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={<Navigate to={user ? '/dashboard' : '/login'} replace />}
        />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  return <AnimatedRoutes />
}
