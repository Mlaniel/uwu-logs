import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DpsChart from './DpsChart.vue'
import { makePlayer, makeHealer } from '../test/fixtures'

// Chart.js uses canvas APIs not available in happy-dom; stub the whole module.
vi.mock('chart.js', () => {
  const MockChart = vi.fn(function (this: any) {
    this.update = vi.fn()
    this.destroy = vi.fn()
    this.data = { labels: [], datasets: [{ data: [] }] }
  }) as any
  MockChart.register = vi.fn()
  return {
    Chart: MockChart,
    BarController: {},
    BarElement: {},
    LineController: {},
    LineElement: {},
    PointElement: {},
    CategoryScale: {},
    LinearScale: {},
    Tooltip: {},
  }
})

import { Chart } from 'chart.js'

const players = [makePlayer(), makeHealer()]

function mountChart(overrides: Record<string, unknown> = {}) {
  return mount(DpsChart, {
    props: { players, view: 'damage', reportId: 'test-report', selectedHref: '', ...overrides },
    attachTo: document.body,
  })
}

beforeEach(() => {
  vi.mocked(Chart).mockClear()
})

describe('DpsChart', () => {
  it('onMounted — Chart instance created', async () => {
    mountChart()
    await flushPromises()
    expect(Chart).toHaveBeenCalledOnce()
  })

  it('Chart constructor called with canvas element, not a ref wrapper', async () => {
    mountChart()
    await flushPromises()
    const [canvasArg] = vi.mocked(Chart).mock.calls[0]
    expect(canvasArg).toBeInstanceOf(HTMLCanvasElement)
  })

  it('props change — destroys old chart and creates a new one', async () => {
    const wrapper = mountChart()
    await flushPromises()

    const firstInstance = vi.mocked(Chart).mock.results[0].value
    const destroySpy = vi.spyOn(firstInstance, 'destroy')

    await wrapper.setProps({ players: [makePlayer({ name: 'NewPlayer' })], view: 'damage' })
    await flushPromises()

    expect(destroySpy).toHaveBeenCalled()
    expect(Chart).toHaveBeenCalledTimes(2)
  })

  it('onUnmounted — destroy() called', async () => {
    const wrapper = mountChart()
    await flushPromises()

    const instance = vi.mocked(Chart).mock.results[0].value
    const destroySpy = vi.spyOn(instance, 'destroy')

    wrapper.unmount()

    expect(destroySpy).toHaveBeenCalledOnce()
  })

  it('unmount during pending update — no error thrown', async () => {
    const wrapper = mountChart()
    expect(() => wrapper.unmount()).not.toThrow()
  })
})
