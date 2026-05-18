import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePlayer } from './usePlayer'

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status }))
  ))
}

const SPELL_INFO = { id: '1', name: 'Frost Strike', color: 'skyblue', icon: 'inv_sword_1' }

function makePlayerResponse(overrides: Partial<{
  ACTUAL: Record<string, string>
  ACTUAL_PERCENT: Record<string, number>
  CASTS: Record<string, string>
  SPELLS_DATA: Record<string, typeof SPELL_INFO>
}> = {}) {
  return {
    SOURCE_NAME: 'Razac',
    IS_PLAYER: true,
    SOURCE: 'Razac',
    ACTUAL: { '1': '50 000' },
    ACTUAL_PERCENT: { '1': 80 },
    CASTS: { '1': '42' },
    SPELLS_DATA: { '1': SPELL_INFO },
    TARGETS: { NPCS: {}, Players: {}, Pets: {} },
    PETS: {},
    ...overrides,
  }
}

beforeEach(() => vi.restoreAllMocks())

describe('usePlayer', () => {
  it('fetchPlayer calls correct URL with default view=damage', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      calls.push(url)
      return Promise.resolve(new Response(JSON.stringify(makePlayerResponse()), { status: 200 }))
    }))

    const { fetchPlayer } = usePlayer()
    await fetchPlayer('abc123', 'Razac')

    expect(calls[0]).toMatch('/api/v2/reports/abc123/player/Razac/')
    expect(calls[0]).toContain('view=damage')
  })

  it('fetchPlayer with view=heal includes view param', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      calls.push(url)
      return Promise.resolve(new Response(JSON.stringify(makePlayerResponse()), { status: 200 }))
    }))

    const { fetchPlayer } = usePlayer()
    await fetchPlayer('abc123', 'Razac', 'heal')

    expect(calls[0]).toContain('view=heal')
  })

  it('spellRows assembled from response — sorted by percent desc', async () => {
    stubFetch(200, makePlayerResponse({
      SPELLS_DATA: {
        '1': { id: '1', name: 'Spell A', color: '', icon: '' },
        '2': { id: '2', name: 'Spell B', color: '', icon: '' },
      },
      ACTUAL: { '1': '10 000', '2': '50 000' },
      ACTUAL_PERCENT: { '1': 20, '2': 80 },
      CASTS: { '1': '5', '2': '20' },
    }))

    const { spellRows, fetchPlayer } = usePlayer()
    await fetchPlayer('abc', 'Razac')

    expect(spellRows.value[0].name).toBe('Spell B')
    expect(spellRows.value[1].name).toBe('Spell A')
  })

  it('spellRows excludes "Total" key', async () => {
    stubFetch(200, makePlayerResponse({
      SPELLS_DATA: {
        Total: { id: 'Total', name: 'Total', color: '', icon: '' },
        '1': SPELL_INFO,
      },
      ACTUAL: { Total: '100 000', '1': '100 000' },
      ACTUAL_PERCENT: { Total: 100, '1': 100 },
      CASTS: { Total: '—', '1': '42' },
    }))

    const { spellRows, fetchPlayer } = usePlayer()
    await fetchPlayer('abc', 'Razac')

    expect(spellRows.value.map(r => r.spell_id)).not.toContain('Total')
  })

  it('loading false after fetch', async () => {
    stubFetch(200, makePlayerResponse())
    const { loading, fetchPlayer } = usePlayer()
    await fetchPlayer('abc', 'Razac')
    expect(loading.value).toBe(false)
  })

  it('404 sets error', async () => {
    stubFetch(404, {})
    const { error, fetchPlayer } = usePlayer()
    await fetchPlayer('abc', 'missing')
    expect(error.value).toMatch(/not found/i)
  })
})
