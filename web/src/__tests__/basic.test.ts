import { parseToISO, formatTR } from '../lib/date'

// Basic test to ensure Jest is working
describe('Basic tests', () => {
  it('should pass a simple test', () => {
    expect(1 + 1).toBe(2)
  })

  it('should test date utilities', () => {
    expect(parseToISO('2025-01-15')).toBe('2025-01-15')
    expect(parseToISO('01/15/2025')).toBe('2025-01-15')
    
    expect(formatTR('2025-01-15')).toBe('15.01.25')
  })
})
