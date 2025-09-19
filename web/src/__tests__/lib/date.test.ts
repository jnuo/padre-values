import { parseToISO, formatTR } from '@/lib/date'

describe('Date utilities', () => {
  describe('parseToISO', () => {
    it('converts date string to ISO format', () => {
      expect(parseToISO('2025-01-15')).toBe('2025-01-15')
      expect(parseToISO('2025-01-15T10:30:00Z')).toBe(null)
      expect(parseToISO('2025-01-15T10:30:00.000Z')).toBe(null)
    })

    it('handles various date formats', () => {
      expect(parseToISO('01/15/2025')).toBe('2025-01-15')
      expect(parseToISO('12/31/2025')).toBe('2025-12-31')
    })

    it('returns null for invalid dates', () => {
      expect(parseToISO('invalid-date')).toBe(null)
      expect(parseToISO('')).toBe(null)
    })
  })

  describe('formatTR', () => {
    it('formats date in Turkish format', () => {
      expect(formatTR('2025-01-15')).toBe('15.01.25')
      expect(formatTR('2025-12-31')).toBe('31.12.25')
    })

    it('handles various input formats', () => {
      expect(formatTR('2025-01-15T10:30:00Z')).toBe('2025-01-15T10:30:00Z')
      expect(formatTR('01/15/2025')).toBe('15.01.25')
    })

    it('returns original string for invalid dates', () => {
      expect(formatTR('invalid-date')).toBe('invalid-date')
      expect(formatTR('')).toBe('')
    })
  })
})
