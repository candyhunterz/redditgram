import { renderHook, act } from '@testing-library/react'
import { useFocusTrap } from './use-focus-trap'
import { useRef, useEffect } from 'react'

describe('useFocusTrap', () => {
  let container: HTMLDivElement
  let button1: HTMLButtonElement
  let button2: HTMLButtonElement
  let button3: HTMLButtonElement
  let outsideButton: HTMLButtonElement

  beforeEach(() => {
    // Create test DOM structure
    container = document.createElement('div')
    container.setAttribute('data-testid', 'trap-container')

    button1 = document.createElement('button')
    button1.textContent = 'Button 1'
    button1.setAttribute('data-testid', 'button-1')

    button2 = document.createElement('button')
    button2.textContent = 'Button 2'
    button2.setAttribute('data-testid', 'button-2')

    button3 = document.createElement('button')
    button3.textContent = 'Button 3'
    button3.setAttribute('data-testid', 'button-3')

    container.appendChild(button1)
    container.appendChild(button2)
    container.appendChild(button3)

    outsideButton = document.createElement('button')
    outsideButton.textContent = 'Outside'
    outsideButton.setAttribute('data-testid', 'outside-button')

    document.body.appendChild(outsideButton)
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('should return a ref for the container', () => {
    const { result } = renderHook(() => useFocusTrap({ isActive: false }))
    expect(result.current.containerRef).toBeDefined()
  })

  it('should focus first focusable element when activated', () => {
    // Create a wrapper that sets up the ref properly
    const TestHook = ({ isActive }: { isActive: boolean }) => {
      const { containerRef, activate, deactivate } = useFocusTrap({ isActive: false })

      useEffect(() => {
        if (containerRef.current === null) {
          (containerRef as React.MutableRefObject<HTMLDivElement>).current = container
        }
      }, [containerRef])

      useEffect(() => {
        if (isActive) {
          activate()
        }
      }, [isActive, activate])

      return { containerRef, activate, deactivate }
    }

    const { rerender } = renderHook(({ isActive }) => TestHook({ isActive }), {
      initialProps: { isActive: false }
    })

    // Need to set up ref before activation
    act(() => {
      rerender({ isActive: true })
    })

    expect(document.activeElement).toBe(button1)
  })

  it('should restore focus to previously focused element when deactivated', () => {
    // Focus the outside button first
    outsideButton.focus()
    expect(document.activeElement).toBe(outsideButton)

    const { result } = renderHook(() => useFocusTrap({ isActive: false }))

    // Set up the ref
    act(() => {
      (result.current.containerRef as React.MutableRefObject<HTMLDivElement>).current = container
    })

    // Activate trap
    act(() => {
      result.current.activate()
    })

    expect(document.activeElement).toBe(button1)

    // Deactivate trap
    act(() => {
      result.current.deactivate()
    })

    // Should restore focus to the previously focused element
    expect(document.activeElement).toBe(outsideButton)
  })

  it('should trap Tab key at the end of focusable elements', () => {
    const { result } = renderHook(() => useFocusTrap({ isActive: false }))

    act(() => {
      (result.current.containerRef as React.MutableRefObject<HTMLDivElement>).current = container
    })

    act(() => {
      result.current.activate()
    })

    // Focus the last button
    act(() => {
      button3.focus()
    })
    expect(document.activeElement).toBe(button3)

    // Simulate Tab key
    act(() => {
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        shiftKey: false,
        cancelable: true,
      })
      container.dispatchEvent(tabEvent)
    })

    // Should wrap to first element
    expect(document.activeElement).toBe(button1)
  })

  it('should trap Shift+Tab at the beginning of focusable elements', () => {
    const { result } = renderHook(() => useFocusTrap({ isActive: false }))

    act(() => {
      (result.current.containerRef as React.MutableRefObject<HTMLDivElement>).current = container
    })

    act(() => {
      result.current.activate()
    })

    // Focus is already on first element after activate
    expect(document.activeElement).toBe(button1)

    // Simulate Shift+Tab key
    act(() => {
      const shiftTabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        shiftKey: true,
        cancelable: true,
      })
      container.dispatchEvent(shiftTabEvent)
    })

    // Should wrap to last element
    expect(document.activeElement).toBe(button3)
  })

  it('should allow normal Tab navigation in the middle', () => {
    const { result } = renderHook(() => useFocusTrap({ isActive: false }))

    act(() => {
      (result.current.containerRef as React.MutableRefObject<HTMLDivElement>).current = container
    })

    act(() => {
      result.current.activate()
    })

    // Focus the first button
    button1.focus()

    // Simulate Tab key - this should NOT be prevented (normal browser behavior)
    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      shiftKey: false,
      cancelable: true,
    })

    const wasDefaultPrevented = !container.dispatchEvent(tabEvent)

    // Default should not be prevented for middle navigation
    expect(wasDefaultPrevented).toBe(false)
  })

  it('should not trap focus when inactive', () => {
    const { result } = renderHook(() => useFocusTrap({ isActive: false }))

    act(() => {
      (result.current.containerRef as React.MutableRefObject<HTMLDivElement>).current = container
    })

    // Focus outside button
    outsideButton.focus()
    expect(document.activeElement).toBe(outsideButton)

    // Tab key should not be trapped (hook is not active)
    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
    })

    container.dispatchEvent(tabEvent)

    // Focus should remain on outside button (no intervention)
    expect(document.activeElement).toBe(outsideButton)
  })

  it('should handle empty container gracefully', () => {
    const emptyContainer = document.createElement('div')
    document.body.appendChild(emptyContainer)

    const { result } = renderHook(() => useFocusTrap({ isActive: false }))

    act(() => {
      (result.current.containerRef as React.MutableRefObject<HTMLDivElement>).current = emptyContainer
    })

    // Should not throw when activating with no focusable elements
    expect(() => {
      act(() => {
        result.current.activate()
      })
    }).not.toThrow()
  })

  it('should focus initial element if provided', () => {
    const initialFocusRef = { current: button2 }

    const { result } = renderHook(() => useFocusTrap({ isActive: false, initialFocusRef }))

    act(() => {
      (result.current.containerRef as React.MutableRefObject<HTMLDivElement>).current = container
    })

    act(() => {
      result.current.activate()
    })

    // Should focus the initial element instead of first focusable
    expect(document.activeElement).toBe(button2)
  })
})
