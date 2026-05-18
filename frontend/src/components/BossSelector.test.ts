import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import BossSelector from './BossSelector.vue'
import type { BossGroup, BossAttempt } from '../types/api'
import { IGNORED_ENCOUNTERS } from '../constants/bosses'

function makeBossGroup(name: string, killType: 'kill' | 'wipe' = 'kill'): BossGroup {
  const attempt: BossAttempt = {
    encounter_name: name,
    difficulty: '25H',
    attempt: 0,
    attempt_from_last_kill: 1,
    attempt_type: killType,
    duration: 180,
    duration_str: '3:00',
    href: `?boss=${name.toLowerCase().replace(' ', '-')}&mode=25H&attempt=0&s=0&f=100`,
  }
  return {
    boss_name: name,
    href: `?boss=${name.toLowerCase().replace(' ', '-')}`,
    text: `All ${name} segments`,
    segments: [attempt],
  }
}

const REGULAR_BOSS = 'Lich King'
const BOSSES: BossGroup[] = [
  { boss_name: 'all', href: '?boss=all', text: 'All boss segments', segments: [] },
  makeBossGroup(REGULAR_BOSS),
  makeBossGroup('Gunship'),
  makeBossGroup('Valithria Dreamwalker'),
  makeBossGroup('Custom Slice'),
]

function mountSelector(bosses = BOSSES) {
  return mount(BossSelector, {
    props: { bosses, selectedHref: '' },
  })
}

describe('BossSelector', () => {
  it('IGNORED_ENCOUNTERS bosses absent from rendered list by default', () => {
    const wrapper = mountSelector()
    const text = wrapper.text()
    for (const name of IGNORED_ENCOUNTERS) {
      expect(text).not.toContain(name)
    }
  })

  it('Gunship not rendered by default', () => {
    const wrapper = mountSelector()
    expect(wrapper.text()).not.toContain('Gunship')
  })

  it('Valithria Dreamwalker not rendered by default', () => {
    const wrapper = mountSelector()
    expect(wrapper.text()).not.toContain('Valithria Dreamwalker')
  })

  it('Custom Slice not rendered by default', () => {
    const wrapper = mountSelector()
    expect(wrapper.text()).not.toContain('Custom Slice')
  })

  it('synthetic "all" entry absent from rendered boss list', () => {
    const wrapper = mountSelector()
    // "All boss segments" text from the all entry should not appear as a clickable boss row
    const bossRows = wrapper.findAll('.boss-row')
    const bossNames = bossRows.map(r => r.text())
    expect(bossNames.some(t => t.includes('All boss segments'))).toBe(false)
  })

  it('"Show all" toggle shows IGNORED_ENCOUNTERS bosses', async () => {
    const wrapper = mountSelector()
    await wrapper.find('.show-all-toggle').trigger('click')
    const text = wrapper.text()
    for (const name of IGNORED_ENCOUNTERS) {
      expect(text).toContain(name)
    }
  })

  it('"Show all" toggled off again — filtered list restores', async () => {
    const wrapper = mountSelector()
    await wrapper.find('.show-all-toggle').trigger('click')
    await wrapper.find('.show-all-toggle').trigger('click')
    const text = wrapper.text()
    for (const name of IGNORED_ENCOUNTERS) {
      expect(text).not.toContain(name)
    }
  })

  it('clicking a boss emits "select" event with correct attempt data', async () => {
    const wrapper = mountSelector()
    await wrapper.find('.boss-row').trigger('click')
    const emitted = wrapper.emitted('select')
    expect(emitted).toBeTruthy()
    expect((emitted![0][0] as BossAttempt).encounter_name).toBe(REGULAR_BOSS)
  })

  it('selected boss has .selected class', () => {
    const selectedHref = `?boss=lich-king`
    const wrapper = mount(BossSelector, {
      props: { bosses: BOSSES, selectedHref },
    })
    const selectedRows = wrapper.findAll('.boss-row.selected')
    expect(selectedRows.length).toBeGreaterThan(0)
  })
})
