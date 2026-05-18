import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DpsChart from './DpsChart.vue'
import { makePlayer, makeHealer } from '../test/fixtures'

// Chart.js uses canvas APIs not available in happy-dom; stub the whole module.
// Must use `function` syntax so `new Chart(...)` works as a constructor.
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
    CategoryScale: {},
    LinearScale: {},
    Tooltip: {},
  }
})

import { Chart } from 'chart.js'

const players = [makePlayer(), makeHealer()]

function mountChart() {
  return mount(DpsChart, {
    props: { players, view: 'damage' },
    attachTo: document.body,
  })
}

beforeEach(() => {
  vi.mocked(Chart).mockClear()
})

describe('DpsChart', () => {
  it('onMounted — Chart instance created, chartInstance is not null', async () => {
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

  it('watch triggers chart.update(), NOT destroy + new Chart', async () => {
    const wrapper = mountChart()
    await flushPromises()

    const instance = vi.mocked(Chart).mock.results[0].value
    const updateSpy = vi.spyOn(instance, 'update')
    const destroySpy = vi.spyOn(instance, 'destroy')

    await wrapper.setProps({ players: [makePlayer({ name: 'NewPlayer' })], view: 'damage' })

    expect(updateSpy).toHaveBeenCalled()
    expect(destroySpy).not.toHaveBeenCalled()
    // Chart constructor should not be called a second time
    expect(Chart).toHaveBeenCalledTimes(1)
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
    // Unmount before flushPromises (before onMounted resolves)
    expect(() => wrapper.unmount()).not.toThrow()
  })
})
