'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

interface UseSlideshowOptions {
  onNext: () => void
  initialInterval?: number
}

const MIN_INTERVAL = 1000 // 1 second
const MAX_INTERVAL = 30000 // 30 seconds
const DEFAULT_INTERVAL = 5000 // 5 seconds

function clampInterval(value: number): number {
  return Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, value))
}

export function useSlideshow({ onNext, initialInterval = DEFAULT_INTERVAL }: UseSlideshowOptions) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [interval, setIntervalState] = useState(() => clampInterval(initialInterval))
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onNextRef = useRef(onNext)
  const intervalRef = useRef(interval)

  // Keep refs up to date
  onNextRef.current = onNext
  intervalRef.current = interval

  // Clear timer helper
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Start timer helper
  const startTimer = useCallback(() => {
    clearTimer()
    timerRef.current = setInterval(() => {
      onNextRef.current()
    }, intervalRef.current)
  }, [clearTimer])

  const play = useCallback(() => {
    setIsPlaying(true)
    startTimer()
  }, [startTimer])

  const pause = useCallback(() => {
    setIsPlaying(false)
    clearTimer()
  }, [clearTimer])

  const toggle = useCallback(() => {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }, [isPlaying, play, pause])

  const setIntervalValue = useCallback((newInterval: number) => {
    const clamped = clampInterval(newInterval)
    setIntervalState(clamped)
    intervalRef.current = clamped
    // Restart timer if playing
    if (isPlaying) {
      startTimer()
    }
  }, [isPlaying, startTimer])

  // Cleanup on unmount
  useEffect(() => {
    return clearTimer
  }, [clearTimer])

  return {
    isPlaying,
    interval,
    play,
    pause,
    toggle,
    setInterval: setIntervalValue,
  }
}
