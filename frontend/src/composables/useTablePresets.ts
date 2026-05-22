import { ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { VisibilityState, SortingState, Updater } from '@tanstack/vue-table'

export interface TablePresetsOptions<
  TPresets extends Record<string, VisibilityState> = Record<string, VisibilityState>,
> {
  storageKey: string
  presets: TPresets
  defaultPreset: keyof TPresets
  defaultSorting?: SortingState
}

function encodePreset(cols: VisibilityState, sort: SortingState): string {
  const json = JSON.stringify({ cols, sort })
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function decodePreset(encoded: string): { cols: VisibilityState; sort: SortingState } | null {
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const pad = padded.length % 4 ? '='.repeat(4 - (padded.length % 4)) : ''
    const obj = JSON.parse(atob(padded + pad))
    if (!obj || typeof obj.cols !== 'object' || !Array.isArray(obj.sort)) return null
    const validSort = (obj.sort as unknown[]).every(
      s => s && typeof (s as { id: string }).id === 'string' && typeof (s as { desc: boolean }).desc === 'boolean',
    )
    if (!validSort) return null
    return { cols: obj.cols as VisibilityState, sort: obj.sort as SortingState }
  } catch {
    return null
  }
}

export function useTablePresets<TPresets extends Record<string, VisibilityState>>(
  opts: TablePresetsOptions<TPresets>,
) {
  const route  = useRoute()
  const router = useRouter()

  const { storageKey, presets, defaultPreset, defaultSorting = [] } = opts

  function defaultVis(): VisibilityState {
    return { ...(presets[defaultPreset] ?? {}) }
  }

  const columnVisibility = ref<VisibilityState>(defaultVis())
  const sorting          = ref<SortingState>(defaultSorting)
  const activePreset     = ref<keyof TPresets | null>(defaultPreset)
  const importError      = ref<string | null>(null)

  // ── Load order: URL param → localStorage → default ─────────────────────────
  onMounted(() => {
    const urlPreset = route.query.preset as string | undefined
    if (urlPreset) {
      const decoded = decodePreset(urlPreset)
      if (decoded) {
        columnVisibility.value = decoded.cols
        sorting.value          = decoded.sort
        activePreset.value     = null
        return
      }
    }
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const saved = JSON.parse(raw) as { cols?: VisibilityState; sort?: SortingState }
        if (saved.cols) columnVisibility.value = saved.cols
        if (saved.sort) sorting.value          = saved.sort
        activePreset.value = null
        return
      }
    } catch {}
    // Defaults already applied above
  })

  // ── Persist to localStorage ─────────────────────────────────────────────────
  watch(
    [columnVisibility, sorting],
    ([cols, sort]) => {
      localStorage.setItem(storageKey, JSON.stringify({ cols, sort }))
    },
    { deep: true },
  )

  // ── Handlers for useVueTable ────────────────────────────────────────────────
  function onColumnVisibilityChange(upd: Updater<VisibilityState>) {
    columnVisibility.value =
      typeof upd === 'function' ? upd(columnVisibility.value) : upd
    activePreset.value = null
  }

  function onSortingChange(upd: Updater<SortingState>) {
    sorting.value = typeof upd === 'function' ? upd(sorting.value) : upd
  }

  // ── Preset management ───────────────────────────────────────────────────────
  function applyPreset(name: keyof TPresets) {
    columnVisibility.value = { ...(presets[name] ?? {}) }
    activePreset.value     = name
  }

  // ── Export / import ─────────────────────────────────────────────────────────
  async function exportPreset(): Promise<void> {
    const encoded = encodePreset(columnVisibility.value, sorting.value)
    await navigator.clipboard.writeText(encoded).catch(() => {})
    router.replace({ query: { ...route.query, preset: encoded } }).catch(() => {})
  }

  function importPreset(encoded: string): boolean {
    const decoded = decodePreset(encoded.trim())
    if (!decoded) {
      importError.value = 'Invalid preset string'
      return false
    }
    columnVisibility.value = decoded.cols
    sorting.value          = decoded.sort
    activePreset.value     = null
    importError.value      = null
    return true
  }

  return {
    columnVisibility,
    sorting,
    activePreset,
    importError,
    applyPreset,
    exportPreset,
    importPreset,
    onColumnVisibilityChange,
    onSortingChange,
  }
}
