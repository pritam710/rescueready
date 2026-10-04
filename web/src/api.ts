export type BackendState = 'checking' | 'connected' | 'demo'

async function requestJson<T>(path: string, init?: RequestInit, timeoutMs = 2500): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(path, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...init?.headers,
      },
    })

    if (!response.ok) throw new Error(`Request failed with ${response.status}`)
    return (await response.json()) as T
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function checkBackend(): Promise<boolean> {
  for (const path of ['/health', '/api/health', '/api/v1/health']) {
    try {
      await requestJson(path, undefined, 1200)
      return true
    } catch {
      // Try the next compatible health route.
    }
  }
  return false
}

export async function loadHousehold(): Promise<Record<string, unknown> | null> {
  try {
    return await requestJson<Record<string, unknown>>('/api/v1/household')
  } catch {
    return null
  }
}

export async function loadReadiness(): Promise<Record<string, unknown> | null> {
  try {
    return await requestJson<Record<string, unknown>>('/api/v1/readiness')
  } catch {
    return null
  }
}

export async function askCoach(message: string): Promise<Record<string, unknown> | null> {
  try {
    return await requestJson<Record<string, unknown>>('/api/v1/coach/chat', {
      method: 'POST',
      body: JSON.stringify({ householdId: 'default-home', message }),
    }, 5000)
  } catch {
    return null
  }
}

export async function startRemoteDrill(): Promise<Record<string, unknown> | null> {
  try {
    return await requestJson<Record<string, unknown>>('/api/v1/drills', {
      method: 'POST',
      body: JSON.stringify({ householdId: 'default-home', scenario: 'fire' }),
    })
  } catch {
    return null
  }
}
