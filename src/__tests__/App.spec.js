import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../App.vue'

describe('App.vue Component Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('renders correctly on initial load', () => {
    const wrapper = mount(App)

    expect(wrapper.find('.brand-name').text()).toContain('DiffChecker')
    expect(wrapper.findAll('.diff-column')).toHaveLength(2)

    // Both textareas should be present initially
    const textareas = wrapper.findAll('.duo-textarea')
    expect(textareas).toHaveLength(2)
  })

  it('allows typing into old and new textareas', async () => {
    const wrapper = mount(App)
    const textareas = wrapper.findAll('.duo-textarea')

    await textareas[0].setValue('Old line')
    await textareas[1].setValue('New line')

    expect(wrapper.vm.oldText).toBe('Old line')
    expect(wrapper.vm.newText).toBe('New line')
  })

  it('switches to diff view on textarea blur (onBlur)', async () => {
    const wrapper = mount(App)
    const textareas = wrapper.findAll('.duo-textarea')

    await textareas[0].setValue('Hello Old World')
    await textareas[0].trigger('blur')

    // Advance fake timers for the blur delay
    vi.advanceTimersByTime(150)
    await wrapper.vm.$nextTick()

    // Left column should now be in diff mode
    expect(wrapper.vm.isEditingOld).toBe(false)
  })

  it('switches back to edit mode when clicking on diff view', async () => {
    const wrapper = mount(App)
    const textareas = wrapper.findAll('.duo-textarea')

    await textareas[0].setValue('Hello World')
    await textareas[0].trigger('blur')
    vi.advanceTimersByTime(150)
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.isEditingOld).toBe(false)

    // Click on the diff view
    const leftDiffView = wrapper.findAll('.diff-stream-view')[0]
    await leftDiffView.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.vm.isEditingOld).toBe(true)
  })

  it('swaps texts between left and right columns', async () => {
    const wrapper = mount(App)
    const textareas = wrapper.findAll('.duo-textarea')

    await textareas[0].setValue('Content Left')
    await textareas[1].setValue('Content Right')

    // Find and click the swap button
    const swapBtn = wrapper.findAll('.duo-btn').find((btn) => btn.text().includes('Đổi bên'))
    expect(swapBtn).toBeDefined()
    await swapBtn.trigger('click')

    expect(wrapper.vm.oldText).toBe('Content Right')
    expect(wrapper.vm.newText).toBe('Content Left')
  })

  it('clears all text and resets to edit mode', async () => {
    const wrapper = mount(App)
    const textareas = wrapper.findAll('.duo-textarea')

    await textareas[0].setValue('Some text')
    await textareas[1].setValue('Other text')

    const clearBtn = wrapper.findAll('.duo-btn').find((btn) => btn.text().includes('Xóa hết'))
    expect(clearBtn).toBeDefined()
    await clearBtn.trigger('click')

    expect(wrapper.vm.oldText).toBe('')
    expect(wrapper.vm.newText).toBe('')
    expect(wrapper.vm.isEditingOld).toBe(true)
    expect(wrapper.vm.isEditingNew).toBe(true)
  })

  it('changes diff mode when clicking granularity buttons', async () => {
    const wrapper = mount(App)
    const buttons = wrapper.findAll('.segment-btn')

    const charsBtn = buttons.find((btn) => btn.text().includes('Từng ký tự'))
    expect(charsBtn).toBeDefined()
    await charsBtn.trigger('click')

    expect(wrapper.vm.diffMode).toBe('chars')

    const linesBtn = buttons.find((btn) => btn.text().includes('Từng dòng'))
    expect(linesBtn).toBeDefined()
    await linesBtn.trigger('click')

    expect(wrapper.vm.diffMode).toBe('lines')
  })

  it('toggles color scheme between all-red and classic', async () => {
    const wrapper = mount(App)
    const buttons = wrapper.findAll('.segment-btn')

    const classicBtn = buttons.find((btn) => btn.text().includes('Cũ /') && btn.text().includes('Mới'))
    expect(classicBtn).toBeDefined()
    await classicBtn.trigger('click')

    expect(wrapper.vm.colorScheme).toBe('classic')

    const allRedBtn = buttons.find((btn) => btn.text().includes('Tô đỏ chỗ khác'))
    expect(allRedBtn).toBeDefined()
    await allRedBtn.trigger('click')

    expect(wrapper.vm.colorScheme).toBe('all-red')
  })

  it('displays EOL mismatch warning when line endings differ', async () => {
    const wrapper = mount(App)

    wrapper.vm.oldText = 'Line 1\r\nLine 2'
    wrapper.vm.newText = 'Line 1\nLine 2'
    await wrapper.vm.$nextTick()

    const eolPill = wrapper.find('.eol-warning-pill')
    expect(eolPill.exists()).toBe(true)
    expect(eolPill.text()).toContain('CRLF ≢ LF')
  })
})
