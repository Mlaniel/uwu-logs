import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { ComputedRef, Ref } from 'vue'
import type { Player } from '../types/api'

export type PlayerView = 'damage' | 'heal' | 'taken'
export type SortKey = 'name' | 'useful_dmg' | 'dps' | 'heal' | 'hps' | 'taken' | 'dtps'

const VALID_VIEWS = new Set<PlayerView>(['damage', 'heal', 'taken'])

function parseView(v: unknown): PlayerView {
  return VALID_VIEWS.has(v as PlayerView) ? (v as PlayerView) : 'damage'
}

function getPlayerSortValue(player: Player, key: SortKey): number {
  if (key === 'name') return 0
  if (key === 'useful_dmg') return player.useful?.per_second ?? player.damage.per_second
  if (key === 'dps') return player.useful?.per_second ?? player.damage.per_second
  if (key === 'heal') return player.heal.per_second
  if (key === 'hps') return player.heal.per_second
  if (key === 'taken') return player.taken.per_second
  if (key === 'dtps') return player.taken.per_second
  return 0
}

export function useFilters(players: ComputedRef<Player[]>) {
  const route = useRoute()
  const router = useRouter()

  const specFilter: Ref<string[]> = ref([])
  const sortKey: Ref<SortKey> = ref('useful_dmg')
  const sortDir: Ref<'asc' | 'desc'> = ref('desc')

  const activeView: ComputedRef<PlayerView> = computed(() => parseView(route.query.view))

  function setView(v: PlayerView): void {
    router.replace({ query: { ...route.query, view: v } })
  }

  function setSort(key: SortKey): void {
    if (sortKey.value === key) {
      sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
    } else {
      sortKey.value = key
      sortDir.value = 'desc'
    }
  }

  function toggleSpec(spec: string): void {
    const idx = specFilter.value.indexOf(spec)
    if (idx === -1) {
      specFilter.value = [...specFilter.value, spec]
    } else {
      specFilter.value = specFilter.value.filter(s => s !== spec)
    }
  }

  const filteredPlayers: ComputedRef<Player[]> = computed(() => {
    let list = players.value

    if (specFilter.value.length > 0) {
      list = list.filter(p => specFilter.value.includes(p.spec_name))
    }

    const key = sortKey.value
    const dir = sortDir.value

    return [...list].sort((a, b) => {
      // Healers (null useful) sort last when sorting by damage columns
      if (key === 'useful_dmg' || key === 'dps') {
        const aNull = a.useful === null
        const bNull = b.useful === null
        if (aNull !== bNull) return aNull ? 1 : -1
      }

      if (key === 'name') {
        const cmp = a.name.localeCompare(b.name)
        return dir === 'asc' ? cmp : -cmp
      }

      const aVal = getPlayerSortValue(a, key)
      const bVal = getPlayerSortValue(b, key)
      return dir === 'desc' ? bVal - aVal : aVal - bVal
    })
  })

  return { activeView, setView, specFilter, sortKey, sortDir, filteredPlayers, setSort, toggleSpec }
}
