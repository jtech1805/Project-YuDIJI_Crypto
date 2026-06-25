import { apiClient } from './client'
import { unwrapArrayData, unwrapData } from './tradeApi'
import type { CreateScoreCheckInput, ScoreCheck, TradeSetup } from '../types/trade'

export const listScoreChecks = async () =>
  unwrapArrayData<ScoreCheck>(await apiClient.get('/score-checks'))

export const createScoreCheck = async (input: CreateScoreCheckInput) =>
  unwrapData<ScoreCheck>(await apiClient.post('/score-checks', input))

export const convertScoreCheck = async (scoreCheckId: string, tradePlanId: string) =>
  unwrapData<TradeSetup>(
    await apiClient.post(`/score-checks/${scoreCheckId}/convert-to-trade-setup`, { tradePlanId }),
  )
