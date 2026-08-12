import { apiClient } from './client'
import { unwrapArrayData, unwrapData } from './tradeApi'
import type {
  CreateScoreCheckInput,
  ScoreCheck,
  ScoreCheckSnapshot,
  TradeSetup,
  UpdateScoreCheckInput,
} from '../types/trade'

export const listScoreChecks = async () =>
  unwrapArrayData<ScoreCheck>(await apiClient.get('/score-checks'))

export const createScoreCheck = async (input: CreateScoreCheckInput) =>
  unwrapData<ScoreCheck>(await apiClient.post('/score-checks', input))

export const convertScoreCheck = async (scoreCheckId: string, tradePlanId: string) =>
  unwrapData<TradeSetup>(
    await apiClient.post(`/score-checks/${scoreCheckId}/convert-to-trade-setup`, { tradePlanId }),
  )

export const updateScoreCheck = async (id: string, input: UpdateScoreCheckInput) =>
  unwrapData<ScoreCheck>(await apiClient.patch(`/score-checks/${id}`, input))

export const getScoreCheckSnapshot = async (id: string) =>
  unwrapData<ScoreCheckSnapshot>(await apiClient.get(`/score-checks/${id}/snapshot`))

export const deleteScoreCheck = async (id: string, reason?: string) =>
  unwrapData<ScoreCheck>(await apiClient.delete(`/score-checks/${id}`, { data: { reason } }))
