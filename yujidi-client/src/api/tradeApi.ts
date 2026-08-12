import type { AxiosResponse } from 'axios'

export function unwrapData<T>(response: AxiosResponse<{ data: T }>): T {
  if (!response.data || !('data' in response.data)) {
    throw new Error('Unexpected API response')
  }
  return response.data.data
}

export function unwrapArrayData<T>(response: AxiosResponse<{ data: T[] }>): T[] {
  const data = unwrapData<T[]>(response)
  return Array.isArray(data) ? data : []
}
