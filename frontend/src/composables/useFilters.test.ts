import { describe, it, expect, beforeEach, vi } from 'vitest'
import { computed, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFilters } from './useFilters'
import { makePlayer, makeHealer } from '../test/fixtures'
import type { Player } from '../types/api'

// Mock vue-router with reactive query so computed(route.query.view) updates correctly
vi.mock('vue-router', () => {
  const query = reactive<Record<string, string>>({})
  const route = { query }
  const replace = vi.fn((to: { query: Record<string, string> }) => {
    // Clear existing keys then assign new ones
    for (const k of Object.keys(query)) delete (query as Record<string, string>)[k]
    Object.assign(query, to.query)
  })
  return {
    useRoute: () => route,
    useRouter: () => ({ replace }),
  }
})

function resetQuery() {
  const route = useRoute()
  for (const k of Object.keys(route.query)) {
    delete (route.query as Record<string, string>)[k]
  }
}

function makeFilters(playerList: Player[]) {
  const players = computed(() => playerList)
  return useFilters(players)
}

beforeEach(() => {
  resetQuery()
  vi.mocked(useRouter().replace).mockClear()
})

describe('useFilters — spec filter', () => {
  it('specFilter = [] returns all players in filteredPlayers', () => {
    const { filteredPlayers } = makeFilters([makePlayer(), makeHealer()])
    expect(filteredPlayers.value).toHaveLength(2)
  })

  it('specFilter = ["Frost Death Knight"] returns only DK players', () => {
    const { filteredPlayers, toggleSpec } = makeFilters([makePlayer(), makeHealer()])
    toggleSpec('Frost Death Knight')
    expect(filteredPlayers.value.map(p => p.name)).toEqual(['Razac'])
  })

  it('toggleSpec adds spec when absent', () => {
    const { specFilter, toggleSpec } = makeFilters([makePlayer()])
    toggleSpec('Frost Death Knight')
    expect(specFilter.value).toContain('Frost Death Knight')
  })

  it('toggleSpec removes spec when present', () => {
    const { specFilter, toggleSpec } = makeFilters([makePlayer()])
    toggleSpec('Frost Death Knight')
    toggleSpec('Frost Death Knight')
    expect(specFilter.value).not.toContain('Frost Death Knight')
  })

  it('empty players array returns []', () => {
    const { filteredPlayers } = makeFilters([])
    expect(filteredPlayers.value).toEqual([])
  })
})

describe('useFilters — sort', () => {
  it('setSort first call on a new key sets key and dir=desc', () => {
    const { sortKey, sortDir, setSort } = makeFilters([makePlayer()])
    setSort('dps')
    expect(sortKey.value).toBe('dps')
    expect(sortDir.value).toBe('desc')
  })

  it('setSort same key twice toggles dir to asc', () => {
    const { sortDir, setSort } = makeFilters([makePlayer()])
    setSort('dps')
    setSort('dps')
    expect(sortDir.value).toBe('asc')
  })

  it('setSort different key resets dir to desc', () => {
    const { sortDir, setSort } = makeFilters([makePlayer()])
    setSort('dps')
    setSort('dps') // now asc
    setSort('name')       // different key → resets to desc
    expect(sortDir.value).toBe('desc')
  })

  it('default sort is useful_dmg desc — highest useful.per_second first', () => {
    // Default initial state: sortKey='useful_dmg', sortDir='desc'
    const high = makePlayer({ name: 'High', useful: { value: '5 000', per_second: 5000, percent: 100 } })
    const low = makePlayer({ name: 'Low', useful: { value: '1 000', per_second: 1000, percent: 20 } })
    const { filteredPlayers } = makeFilters([low, high])
    expect(filteredPlayers.value[0].name).toBe('High')
  })

  it('setSort useful_dmg after switching away — sorts by useful_dmg desc', () => {
    const high = makePlayer({ name: 'High', useful: { value: '5 000', per_second: 5000, percent: 100 } })
    const low = makePlayer({ name: 'Low', useful: { value: '1 000', per_second: 1000, percent: 20 } })
    const { filteredPlayers, setSort } = makeFilters([low, high])
    setSort('name')        // switch away
    setSort('useful_dmg') // back to useful_dmg — fresh key → desc
    expect(filteredPlayers.value[0].name).toBe('High')
  })

  it('player with useful=null sorts last regardless of sort key', () => {
    const healer = makeHealer()
    const dps = makePlayer()
    const { filteredPlayers } = makeFilters([healer, dps])
    const last = filteredPlayers.value[filteredPlayers.value.length - 1]
    expect(last.name).toBe(healer.name)
  })

  it('player with useful=null — no crash', () => {
    const { filteredPlayers } = makeFilters([makeHealer()])
    expect(() => filteredPlayers.value).not.toThrow()
  })
})

describe('useFilters — activeView', () => {
  it('defaults to "damage" when ?view param absent', () => {
    const { activeView } = makeFilters([])
    expect(activeView.value).toBe('damage')
  })

  it('setView("heal") updates route query and activeView', () => {
    const { activeView, setView } = makeFilters([])
    setView('heal')
    expect(activeView.value).toBe('heal')
  })

  it('setView("taken") updates activeView to taken', () => {
    const { activeView, setView } = makeFilters([])
    setView('taken')
    expect(activeView.value).toBe('taken')
  })

  it('invalid ?view=xyz in URL falls back to "damage"', () => {
    const route = useRoute()
    ;(route.query as Record<string, string>)['view'] = 'xyz'
    const { activeView } = makeFilters([])
    expect(activeView.value).toBe('damage')
  })
})
