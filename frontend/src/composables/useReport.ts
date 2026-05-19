import { computed, onUnmounted } from 'vue'
import { useFetch } from './useFetch'
import type { Player, ReportApiResponse, StatCell } from '../types/api'

const SKIP_NAMES = new Set(['Total'])

// The API returns per_second as a space-formatted string ("5 617.7"), not a number.
// Normalize it so downstream numeric comparisons work correctly.
function normalizeStatCell(raw: StatCell | undefined): StatCell {
  if (!raw) return { value: '', per_second: 0, percent: 0 }
  return {
    value: raw.value,
    per_second: parseFloat(String(raw.per_second).replace(/\s+/g, '')) || 0,
    percent: raw.percent,
  }
}

function assemblePlayer(
  name: string,
  response: ReportApiResponse,
): Player | null {
  const spec = response.SPECS[name]
  if (!spec) return null

  const rawUseful = response.DATA.useful?.[name]

  return {
    name,
    spec_name: spec[0],
    spec_icon: spec[1],
    class_name: response.PLAYER_CLASSES[name] ?? '',
    useful: rawUseful ? normalizeStatCell(rawUseful) : null,
    damage: normalizeStatCell(response.DATA.damage?.[name]),
    heal: normalizeStatCell(response.DATA.heal?.[name]),
    heal_total: normalizeStatCell(response.DATA.heal_total?.[name]),
    taken: normalizeStatCell(response.DATA.taken?.[name]),
  }
}

export function useReport() {
  const { data: report, loading, error, execute, abort } = useFetch<ReportApiResponse>()

  const players = computed<Player[]>(() => {
    if (!report.value) return []
    const names = Object.keys(report.value.SPECS).filter(n => !SKIP_NAMES.has(n))
    return names.flatMap(name => {
      const p = assemblePlayer(name, report.value!)
      return p ? [p] : []
    })
  })

  async function fetchOverview(reportId: string, params?: Record<string, string>): Promise<void> {
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    await execute(`/api/v2/reports/${reportId}/${query}`)
  }

  onUnmounted(abort)

  return { report, players, loading, error, fetchOverview }
}
