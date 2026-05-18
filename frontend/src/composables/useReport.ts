import { computed, onUnmounted } from 'vue'
import { useFetch } from './useFetch'
import type { Player, ReportApiResponse } from '../types/api'

const SKIP_NAMES = new Set(['Total'])

function assemblePlayer(
  name: string,
  response: ReportApiResponse,
): Player | null {
  const spec = response.SPECS[name]
  if (!spec) return null

  const empty = { value: '', per_second: 0, percent: 0 }

  return {
    name,
    spec_name: spec[0],
    spec_icon: spec[1],
    class_name: response.PLAYER_CLASSES[name] ?? '',
    useful: response.DATA.useful?.[name] ?? null,
    damage: response.DATA.damage?.[name] ?? empty,
    heal: response.DATA.heal?.[name] ?? empty,
    heal_total: response.DATA.heal_total?.[name] ?? empty,
    taken: response.DATA.taken?.[name] ?? empty,
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
