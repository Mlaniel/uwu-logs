import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useFetch } from './useFetch'

// Helpers
function mockFetch(status: number, body: unknown, delay = 0) {
  return vi.fn(() =>
    new Promise<Response>(resolve =>
      setTimeout(() => resolve(new Response(JSON.stringify(body), { status })), delay)
    )
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('useFetch', () => {
  it('GET happy path — data populated, loading false, error null', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { ok: true }))
    const { data, loading, error, execute } = useFetch<{ ok: boolean }>()

    await execute('/api/v2/test/')

    expect(data.value).toEqual({ ok: true })
    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('404 — error set to "not found" message', async () => {
    vi.stubGlobal('fetch', mockFetch(404, {}))
    const { data, error, execute } = useFetch()

    await execute('/api/v2/missing/')

    expect(data.value).toBeNull()
    expect(error.value).toMatch(/not found/i)
  })

  it('429 — error includes retry_after from response body', async () => {
    vi.stubGlobal('fetch', mockFetch(429, { retry_after: 42 }))
    const { error, execute } = useFetch()

    await execute('/api/v2/limited/')

    expect(error.value).toMatch(/42/)
  })

  it('429 without retry_after body — fallback message', async () => {
    vi.stubGlobal('fetch', mockFetch(429, {}))
    const { error, execute } = useFetch()

    await execute('/api/v2/limited/')

    expect(error.value).toMatch(/too many/i)
  })

  it('500 — generic server error message', async () => {
    vi.stubGlobal('fetch', mockFetch(500, {}))
    const { error, execute } = useFetch()

    await execute('/api/v2/broken/')

    expect(error.value).toMatch(/server error/i)
  })

  it('AbortError — error NOT set, loading ends silently', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      const err = new DOMException('Aborted', 'AbortError')
      return Promise.reject(err)
    }))
    const { error, loading, execute } = useFetch()

    await execute('/api/v2/aborted/')

    expect(error.value).toBeNull()
    expect(loading.value).toBe(false)
  })

  it('second call cancels first — only second result populates data', async () => {
    const fetchImpl = vi.fn()
      .mockImplementationOnce((_url: string, init: RequestInit) =>
        // First fetch: rejects with AbortError when its signal fires
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          )
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve(new Response(JSON.stringify({ call: 2 }), { status: 200 }))
      )

    vi.stubGlobal('fetch', fetchImpl)

    const { data, execute } = useFetch<{ call: number }>()

    // Start first call — hangs until aborted
    const p1 = execute('/api/v2/first/')
    // Second call immediately aborts the first
    const p2 = execute('/api/v2/second/')

    await Promise.all([p1, p2])

    expect(data.value?.call).toBe(2)
  })

  it('POST — correct Content-Type header and JSON body', async () => {
    const captured: RequestInit[] = []
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => {
      captured.push(init)
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    }))

    const { execute } = useFetch()
    await execute('/api/v2/compare/', { method: 'POST', body: { class: 'warrior' } })

    expect(captured[0].method).toBe('POST')
    expect((captured[0].headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(captured[0].body).toBe(JSON.stringify({ class: 'warrior' }))
  })
})
