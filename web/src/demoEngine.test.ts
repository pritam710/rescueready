import { describe, expect, it } from 'vitest'
import { getDemoReply, scoreForChecked } from './demoEngine'

describe('demo coach', () => {
  it('routes supply questions to inventory guidance', () => {
    expect(getDemoReply('What supplies are missing?').source).toBe('Household inventory')
  })

  it('keeps readiness scores bounded', () => {
    expect(scoreForChecked(0, 10)).toBe(32)
    expect(scoreForChecked(10, 10)).toBe(85)
    expect(scoreForChecked(20, 10)).toBe(100)
  })
})
