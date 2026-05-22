import { computed, onUnmounted } from 'vue'
import { useFetch } from './useFetch'
import type { PlayerApiResponse, SpellRow } from '../types/api'

export type PlayerView = 'damage' | 'heal' | 'taken'

function parseFormatted(s: string | undefined): number {
  if (!s) return 0
  return parseInt(s.replace(/\s/g, ''), 10) || 0
}

export function usePlayer() {
  const { data, loading, error, execute, abort } = useFetch<PlayerApiResponse>()

  const spellRows = computed<SpellRow[]>(() => {
    if (!data.value) return []
    const { ACTUAL, ACTUAL_PERCENT, CASTS, SPELLS_DATA, HITS, MISSES } = data.value
    return Object.entries(SPELLS_DATA)
      .filter(([id]) => id !== 'Total')
      .map(([id, spell]) => {
        const h = HITS?.[id]
        const direct = h?.HIT
        const periodic = h?.DOT

        const hitCount  = parseFormatted(direct?.hits)  + parseFormatted(periodic?.hits)
        const critCount = parseFormatted(direct?.crits) + parseFormatted(periodic?.crits)
        const total     = hitCount + critCount
        const crit_pct  = total > 0 ? (critCount / total * 100).toFixed(1) + '%' : ''

        return {
          spell_id: id,
          name: spell.name,
          icon: spell.icon,
          color: spell.color,
          actual:  ACTUAL[id]         ?? '',
          percent: parseFloat((ACTUAL_PERCENT[id] ?? '0').replace('%', '')) || 0,
          casts:   CASTS[id]          ?? '',
          hit_total: total     > 0 ? total.toString()     : '',
          crits:     critCount > 0 ? critCount.toString() : '',
          crit_pct,
          avg_hit:  direct?.hit_avg  ?? '',
          avg_crit: direct?.crit_avg ?? '',
          misses:   MISSES?.[id]      ?? '',
        }
      })
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
