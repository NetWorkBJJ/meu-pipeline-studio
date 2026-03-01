import { describe, it, expect } from 'vitest'
import { msToUs, usToMs, msToDisplay, msToSrtTime } from '@/lib/time'

describe('msToUs', () => {
  it('converts 1000ms to 1000000us', () => {
    expect(msToUs(1000)).toBe(1000000)
  })

  it('converts 0ms to 0us', () => {
    expect(msToUs(0)).toBe(0)
  })
})

describe('usToMs', () => {
  it('converts 1000000us to 1000ms', () => {
    expect(usToMs(1000000)).toBe(1000)
  })

  it('converts 0us to 0ms', () => {
    expect(usToMs(0)).toBe(0)
  })
})

describe('roundtrip conversion', () => {
  it('usToMs(msToUs(x)) === x', () => {
    const values = [0, 500, 1000, 5000, 12345, 100000]
    for (const v of values) {
      expect(usToMs(msToUs(v))).toBe(v)
    }
  })
})

describe('msToDisplay', () => {
  it('formats MM:SS.mmm correctly', () => {
    expect(msToDisplay(65500)).toBe('01:05.500')
  })

  it('formats zero', () => {
    expect(msToDisplay(0)).toBe('00:00.000')
  })

  it('formats large values', () => {
    expect(msToDisplay(125050)).toBe('02:05.050')
  })
})

describe('msToSrtTime', () => {
  it('formats HH:MM:SS,mmm correctly', () => {
    expect(msToSrtTime(3665123)).toBe('01:01:05,123')
  })

  it('formats zero', () => {
    expect(msToSrtTime(0)).toBe('00:00:00,000')
  })

  it('formats values over 1 hour', () => {
    expect(msToSrtTime(7200000)).toBe('02:00:00,000')
  })

  it('handles millisecond precision', () => {
    expect(msToSrtTime(1001)).toBe('00:00:01,001')
  })
})
