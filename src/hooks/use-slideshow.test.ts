import { renderHook, act } from '@testing-library/react'
import { useSlideshow } from './use-slideshow'

describe('useSlideshow', () => {
  const mockOnNext = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers({ legacyFakeTimers: false })
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('should start with slideshow disabled', () => {
    const { result } = renderHook(() => useSlideshow({ onNext: mockOnNext }))
    expect(result.current.isPlaying).toBe(false)
  })

  it('should default to 5 second interval', () => {
    const { result } = renderHook(() => useSlideshow({ onNext: mockOnNext }))
    expect(result.current.interval).toBe(5000)
  })

  it('should start playing when play is called', () => {
    const { result } = renderHook(() => useSlideshow({ onNext: mockOnNext }))

    act(() => {
      result.current.play()
    })

    expect(result.current.isPlaying).toBe(true)
  })

  it('should stop playing when pause is called', () => {
    const { result } = renderHook(() => useSlideshow({ onNext: mockOnNext }))

    act(() => {
      result.current.play()
    })

    act(() => {
      result.current.pause()
    })

    expect(result.current.isPlaying).toBe(false)
  })

  it('should toggle playing state', () => {
    const { result } = renderHook(() => useSlideshow({ onNext: mockOnNext }))

    expect(result.current.isPlaying).toBe(false)

    act(() => {
      result.current.toggle()
    })

    expect(result.current.isPlaying).toBe(true)

    act(() => {
      result.current.toggle()
    })

    expect(result.current.isPlaying).toBe(false)
  })

  it('should call onNext after interval while playing', () => {
    const { result } = renderHook(() => useSlideshow({ onNext: mockOnNext }))

    act(() => {
      result.current.play()
    })

    expect(mockOnNext).not.toHaveBeenCalled()
    expect(result.current.isPlaying).toBe(true)

    // Check timer count
    expect(jest.getTimerCount()).toBe(1)

    // Advance timer to fire the interval callback
    act(() => {
      jest.runOnlyPendingTimers()
    })

    expect(mockOnNext).toHaveBeenCalledTimes(1)

    act(() => {
      jest.runOnlyPendingTimers()
    })

    expect(mockOnNext).toHaveBeenCalledTimes(2)
  })

  it('should not call onNext when paused', () => {
    const { result } = renderHook(() => useSlideshow({ onNext: mockOnNext }))

    act(() => {
      result.current.play()
    })

    act(() => {
      result.current.pause()
    })

    act(() => {
      jest.advanceTimersByTime(10000)
    })

    expect(mockOnNext).not.toHaveBeenCalled()
  })

  it('should allow setting custom interval', () => {
    const { result } = renderHook(() => useSlideshow({ onNext: mockOnNext }))

    act(() => {
      result.current.setInterval(3000)
    })

    expect(result.current.interval).toBe(3000)
  })

  it('should respect custom interval when playing', () => {
    const { result } = renderHook(() => useSlideshow({ onNext: mockOnNext }))

    act(() => {
      result.current.setInterval(3000)
    })

    act(() => {
      result.current.play()
    })

    expect(jest.getTimerCount()).toBe(1)

    act(() => {
      jest.runOnlyPendingTimers()
    })

    expect(mockOnNext).toHaveBeenCalledTimes(1)
  })

  it('should clamp interval to minimum 1 second', () => {
    const { result } = renderHook(() => useSlideshow({ onNext: mockOnNext }))

    act(() => {
      result.current.setInterval(500)
    })

    expect(result.current.interval).toBe(1000)
  })

  it('should clamp interval to maximum 30 seconds', () => {
    const { result } = renderHook(() => useSlideshow({ onNext: mockOnNext }))

    act(() => {
      result.current.setInterval(60000)
    })

    expect(result.current.interval).toBe(30000)
  })

  it('should use initialInterval prop', () => {
    const { result } = renderHook(() =>
      useSlideshow({ onNext: mockOnNext, initialInterval: 7000 })
    )
    expect(result.current.interval).toBe(7000)
  })

  it('should stop when component unmounts', () => {
    const { result, unmount } = renderHook(() =>
      useSlideshow({ onNext: mockOnNext })
    )

    act(() => {
      result.current.play()
    })

    unmount()

    act(() => {
      jest.advanceTimersByTime(10000)
    })

    expect(mockOnNext).not.toHaveBeenCalled()
  })

  it('should restart timer when interval changes while playing', () => {
    const { result } = renderHook(() => useSlideshow({ onNext: mockOnNext }))

    act(() => {
      result.current.play()
    })

    // Advance 2 seconds - not enough for 5s interval
    act(() => {
      jest.advanceTimersByTime(2000)
    })

    expect(mockOnNext).not.toHaveBeenCalled()

    // Change interval to 3 seconds - should restart the timer
    act(() => {
      result.current.setInterval(3000)
    })

    // Timer should be restarted
    expect(jest.getTimerCount()).toBe(1)

    // Advance to next timer (3 seconds with new interval)
    act(() => {
      jest.runOnlyPendingTimers()
    })

    expect(mockOnNext).toHaveBeenCalledTimes(1)
  })
})
