import { computed, onUnmounted } from 'vue'
import { useFetch } from './useFetch'
import type { PlayerApiResponse, SpellRow } from '../types/api'

export type PlayerView = 'damage' | 'heal' | 'taken'

function parseFormatted(s: string | undefined): number {
  if (!s) return 0
  return parseInt(s.replace(/\s/g, ''), 10) || 0
}

function fmtPct(hit: number, crit: number): string {
  const total = hit + crit
  return total > 0 ? (crit / total * 100).toFixed(1) + '%' : ''
}

export function usePlayer() {
  const { data, loading, error, execute, abort } = useFetch<PlayerApiResponse>()

  const spellRows = computed<SpellRow[]>(() => {
    if (!data.value) return []
    const {
      ACTUAL, ACTUAL_PERCENT, CASTS, SPELLS_DATA,
      HITS, MISSES, MISS_DETAILED, REDUCED_DETAILED,
    } = data.value

    return Object.entries(SPELLS_DATA)
      .filter(([id]) => id !== 'Total')
      .map(([id, spell]) => {
        const h     = HITS?.[id]
        const dir   = h?.HIT
        const dot   = h?.DOT

        const dirHits  = parseFormatted(dir?.hits)
        const dirCrits = parseFormatted(dir?.crits)
        const dotHits  = parseFormatted(dot?.hits)
        const dotCrits = parseFormatted(dot?.crits)
        const totalHits   = dirHits  + dotHits
        const totalCrits  = dirCrits + dotCrits
        const hitTotal    = totalHits + totalCrits

        const md = MISS_DETAILED?.[id] ?? {}
        const rd = REDUCED_DETAILED?.[id] ?? {}

        return {
          spell_id: id,
          name:     spell.name,
          icon:     spell.icon,
          color:    spell.color,
          actual:   ACTUAL[id]   ?? '',
          percent:  parseFloat((ACTUAL_PERCENT[id] ?? '0').replace('%', '')) || 0,
          casts:    CASTS[id]    ?? '',

          // ── Direct ──────────────────────────────────────────────────────────
          hit_total:    hitTotal    > 0 ? hitTotal.toString()    : '',
          direct_hits:  dirHits     > 0 ? dirHits.toString()     : '',
          direct_crits: dirCrits    > 0 ? dirCrits.toString()    : '',
          crit_pct:     fmtPct(totalHits, totalCrits),
          avg_hit:      dir?.hit_avg  ?? '',
          avg_crit:     dir?.crit_avg ?? '',
          max_hit:      dir?.hits_avg?.[0]  ?? '',
          max_crit:     dir?.crits_avg?.[0] ?? '',

          // ── Periodic ────────────────────────────────────────────────────────
          dot_hits:     dotHits  > 0 ? dotHits.toString()  : '',
          dot_crits:    dotCrits > 0 ? dotCrits.toString() : '',
          dot_crit_pct: fmtPct(dotHits, dotCrits),
          dot_avg_hit:  dot?.hit_avg        ?? '',
          dot_avg_crit: dot?.crit_avg       ?? '',
          dot_max_hit:  dot?.hits_avg?.[0]  ?? '',

          // ── Miss counts ──────────────────────────────────────────────────────
          misses:      MISSES?.[id]    ?? '',
          miss:        md['MISS']      ?? '',
          dodge:       md['DODGE']     ?? '',
          parry:       md['PARRY']     ?? '',
          resist_miss: md['RESIST']    ?? '',
          absorb_miss: md['ABSORB']    ?? '',
          immune:      md['IMMUNE']    ?? '',
          glancing:    md['GLANCING']  ?? '',
          block:       md['BLOCK']     ?? '',
          reflect:     md['REFLECT']   ?? '',

          // ── Damage modifiers ─────────────────────────────────────────────────
          overkill: rd['OVERKILL'] ?? '',
          resisted: rd['RESISTED'] ?? '',
          absorbed: rd['ABSORBED'] ?? '',
        } satisfies SpellRow
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
