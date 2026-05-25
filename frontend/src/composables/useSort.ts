import { ref } from 'vue'

type SortDir = 'asc' | 'desc'

function toNum(v: string | number): number | null {
  if (typeof v === 'number') return v
  const n = parseFloat(String(v).replace(/[,%\s]/g, ''))
  return isNaN(n) ? null : n
}

function cmpValues(a: string | number, b: string | number): number {
  const an = toNum(a)
  const bn = toNum(b)
  if (an !== null && bn !== null) return an - bn
  return String(a).localeCompare(String(b))
}

export function useSort(defaultKey = '', defaultDir: SortDir = 'desc') {
  const sortKey = ref(defaultKey)
  const sortDir = ref<SortDir>(defaultDir)

  function setSort(key: string): void {
    if (sortKey.value === key) {
      sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortKey.value = key
      sortDir.value = 'desc'
    }
  }

  function sortIcon(key: string): string {
    if (sortKey.value !== key) return '⇅'
    return sortDir.value === 'desc' ? '↓' : '↑'
  }

  function sorted<T>(rows: T[], getValue: (row: T, key: string) => string | number): T[] {
    if (!sortKey.value) return rows
    const key = sortKey.value
    const dir = sortDir.value
    return [...rows].sort((a, b) => {
      const av = getValue(a, key)
      const bv = getValue(b, key)
      // Empty values always go to bottom
      const ae = av === '' || av == null
      const be = bv === '' || bv == null
      if (ae && be) return 0
      if (ae) return 1
      if (be) return -1
      const cmp = cmpValues(av, bv)
      return dir === 'desc' ? -cmp : cmp
    })
  }

  return { sortKey, sortDir, setSort, sortIcon, sorted }
}
