import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { ComputedRef, Ref } from 'vue'
import type { Player } from '../types/api'

export type PlayerView = 'damage' | 'heal' | 'taken'

const VALID_VIEWS = new Set<PlayerView>(['damage', 'heal', 'taken'])

function parseView(v: unknown): PlayerView {
  return VALID_VIEWS.has(v as PlayerView) ? (v as PlayerView) : 'damage'
}

export function useFilters(players: ComputedRef<Player[]>) {
  const route = useRoute()
  const router = useRouter()

  const specFilter: Ref<string[]> = ref([])

  const activeView: ComputedRef<PlayerView> = computed(() => parseView(route.query.view))

  function setView(v: PlayerView): void {
    router.replace({ query: { ...route.query, view: v } })
  }

  function toggleSpec(spec: string): void {
    const idx = specFilter.value.indexOf(spec)
    if (idx === -1) {
      specFilter.value = [...specFilter.value, spec]
    } else {
      specFilter.value = specFilter.value.filter(s => s !== spec)
    }
  }

  // Spec-filtered only — sorting is handled by PlayerTable via TanStack
  const filteredPlayers: ComputedRef<Player[]> = computed(() => {
    if (specFilter.value.length === 0) return players.value
    return players.value.filter(p => specFilter.value.includes(p.spec_name))
  })

  return { activeView, setView, specFilter, filteredPlayers, toggleSpec }
}
