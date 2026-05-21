import { computed, onUnmounted } from 'vue'
import { useFetch } from './useFetch'
import type { PlayerApiResponse, SpellRow } from '../types/api'

export type PlayerView = 'damage' | 'heal' | 'taken'

export function usePlayer() {
  const { data, loading, error, execute, abort } = useFetch<PlayerApiResponse>()

  const spellRows = computed<SpellRow[]>(() => {
    if (!data.value) return []
    const { ACTUAL, ACTUAL_PERCENT, CASTS, SPELLS_DATA } = data.value
    return Object.entries(SPELLS_DATA)
      .filter(([id]) => id !== 'Total')
      .map(([id, spell]) => ({
        spell_id: id,
        name: spell.name,
        icon: spell.icon,
        color: spell.color,
        actual: ACTUAL[id] ?? '',
        percent: ACTUAL_PERCENT[id] ?? 0,
        casts: CASTS[id] ?? '',
      }))
      .sort((a, b) => b.percent - a.percent)
  })

  async function fetchPlayer(
    reportId: string,
    playerName: string,
    view: PlayerView = 'damage',
    targetGuid?: string,
    bossParams?: Record<string, string>,
  ): Promise<void> {
    const params = new URLSearchParams({ view, ...bossParams })
    if (targetGuid) params.set('target', targetGuid)
    await execute(`/api/v2/reports/${reportId}/player/${encodeURIComponent(playerName)}/?${params}`)
  }

  onUnmounted(abort)

  return { data, spellRows, loading, error, fetchPlayer }
}
