import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useReport } from './useReport'
import { makeApiResponse } from '../test/fixtures'

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status }))
  ))
}

beforeEach(() => vi.restoreAllMocks())

describe('useReport', () => {
  it('fetchOverview calls correct /api/v2/reports/:id/ URL', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      calls.push(url)
      return Promise.resolve(new Response(JSON.stringify(makeApiResponse()), { status: 200 }))
    }))

    const { fetchOverview } = useReport()
    await fetchOverview('abc123')

    expect(calls[0]).toBe('/api/v2/reports/abc123/')
  })

  it('report.value replaced (not mutated) on each successful fetch', async () => {
    stubFetch(200, makeApiResponse())
    const { report, fetchOverview } = useReport()

    await fetchOverview('abc123')
    const first = report.value

    stubFetch(200, makeApiResponse({ REPORT_NAME: 'SecondRaid' }))
    await fetchOverview('abc123')

    expect(report.value).not.toBe(first)
    expect(report.value?.REPORT_NAME).toBe('SecondRaid')
  })

  it('loading is true during fetch, false after', async () => {
    let resolveReq!: (r: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(r => { resolveReq = r })))

    const { loading, fetchOverview } = useReport()

    const p = fetchOverview('abc123')
    expect(loading.value).toBe(true)

    resolveReq(new Response(JSON.stringify(makeApiResponse()), { status: 200 }))
    await p
    expect(loading.value).toBe(false)
  })

  it('404 — error set to "not found" message', async () => {
    stubFetch(404, {})
    const { error, fetchOverview } = useReport()

    await fetchOverview('missing')

    expect(error.value).toMatch(/not found/i)
  })

  it('players computed — assembles Player[] from raw response, skips Total key', async () => {
    const response = makeApiResponse()
    // Add a "Total" key that must be skipped
    response.SPECS['Total'] = ['Total', 'ability_hunter_readiness']
    response.DATA.damage['Total'] = { value: '2 200', per_second: 2200, percent: 100 }

    stubFetch(200, response)
    const { players, fetchOverview } = useReport()
    await fetchOverview('abc123')

    const names = players.value.map(p => p.name)
    expect(names).not.toContain('Total')
    expect(names).toContain('Razac')
    expect(names).toContain('Healbot')

    const razac = players.value.find(p => p.name === 'Razac')!
    // class_name must be CSS-kebab-case so CLASS_COLORS lookup works
    expect(razac.class_name).toBe('death-knight')
  })

  it('players — Healbot has useful=null (no entry in DATA.useful)', async () => {
    stubFetch(200, makeApiResponse())
    const { players, fetchOverview } = useReport()
    await fetchOverview('abc123')

    const healbot = players.value.find(p => p.name === 'Healbot')
    expect(healbot?.useful).toBeNull()
  })
})
