import { ref, shallowRef } from 'vue'
import type { Ref, ShallowRef } from 'vue'

export interface UseFetchOptions {
  method?: 'GET' | 'POST'
  body?: unknown
}

export interface UseFetch<T> {
  data: ShallowRef<T | null>
  loading: Ref<boolean>
  error: Ref<string | null>
  execute: (url: string, options?: UseFetchOptions) => Promise<void>
  abort: () => void
}

function parseErrorMessage(status: number, body: Record<string, unknown>): string {
  if (status === 404) return 'Report not found or has been deleted.'
  if (status === 429) {
    const retryAfter = body?.retry_after
    return retryAfter != null
      ? `Too many requests. Try again in ${retryAfter}s.`
      : 'Too many requests. Please wait before retrying.'
  }
  return 'Server error. Please try again.'
}

export function useFetch<T>(): UseFetch<T> {
  const data = shallowRef<T | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let controller: AbortController | null = null

  async function execute(url: string, options: UseFetchOptions = {}): Promise<void> {
    controller?.abort()
    controller = new AbortController()

    loading.value = true
    error.value = null

    try {
      const isPost = options.method === 'POST'
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        signal: controller.signal,
        headers: isPost ? { 'Content-Type': 'application/json' } : undefined,
        body: isPost ? JSON.stringify(options.body) : undefined,
      })

      if (!response.ok) {
        let body: Record<string, unknown> = {}
        try { body = await response.json() } catch { /* ignore parse error */ }
        error.value = parseErrorMessage(response.status, body)
        return
      }

      data.value = await response.json() as T
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Intentional abort — not a user-visible error
        return
      }
      error.value = 'Network error. Please check your connection.'
    } finally {
      loading.value = false
    }
  }

  function abort(): void {
    controller?.abort()
  }

  return { data, loading, error, execute, abort }
}
