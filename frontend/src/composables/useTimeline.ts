import { computed, onUnmounted } from 'vue'
import { useFetch } from './useFetch'
import type { TimelineApiResponse, SpellInfo, CastEvent } from '../types/api'

export interface TimelineRow {
  spell_id: string
  spell: SpellInfo
  events: CastEvent[]
}

export function useTimeline() {
  const { data, loading, error, execute, abort } = useFetch<TimelineApiResponse>()

  const rows = computed<TimelineRow[]>(() => {
    if (!data.value) return []
    const { DATA, SPELLS } = data.value
    return Object.entries(DATA)
      .map(([id, events]) => ({
        spell_id: id,
        spell: SPELLS[id] ?? { id, name: id, color: '', icon: '' },
        events,
      }))
      .sort((a, b) => b.events.length - a.events.length)
  })

  async function fetchTimeline(
    reportId: string,
    boss: string,
    attempt: number,
    playerName: string,
  ): Promise<void> {
    await execute(`/api/v2/reports/${reportId}/timeline`, {
      method: 'POST',
      body: { boss, attempt, name: playerName },
    })
  }

  onUnmounted(abort)

  return { data, rows, loading, error, fetchTimeline }
}
