'use client'

import { useRef, useEffect, useCallback, RefObject } from 'react'

interface UseFocusTrapOptions {
  isActive?: boolean
  initialFocusRef?: RefObject<HTMLElement>
}

const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
  return Array.from(elements).filter(el => {
    // Filter out hidden elements (check for display:none or visibility:hidden)
    const style = window.getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false
    }
    return true
  })
}

export function useFocusTrap({ isActive = false, initialFocusRef }: UseFocusTrapOptions = {}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)
  const isActiveRef = useRef(false)
  const initialFocusRefStable = useRef(initialFocusRef)
  initialFocusRefStable.current = initialFocusRef

  // Handle Tab key trapping
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isActiveRef.current || event.key !== 'Tab') return

    const container = containerRef.current
    if (!container) return

    const focusableElements = getFocusableElements(container)
    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    const activeElement = document.activeElement

    if (event.shiftKey) {
      // Shift+Tab: if on first element, wrap to last
      if (activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      }
    } else {
      // Tab: if on last element, wrap to first
      if (activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }
  }, [])

  const activate = useCallback(() => {
    const container = containerRef.current
    if (!container || isActiveRef.current) return

    isActiveRef.current = true

    // Store currently focused element
    previousActiveElementRef.current = document.activeElement as HTMLElement

    // Focus initial element or first focusable
    if (initialFocusRefStable.current?.current) {
      initialFocusRefStable.current.current.focus()
    } else {
      const focusableElements = getFocusableElements(container)
      if (focusableElements.length > 0) {
        focusableElements[0].focus()
      }
    }

    // Add keydown listener
    container.addEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const deactivate = useCallback(() => {
    const container = containerRef.current
    if (!isActiveRef.current) return

    isActiveRef.current = false

    // Remove keydown listener
    if (container) {
      container.removeEventListener('keydown', handleKeyDown)
    }

    // Restore focus when deactivated
    if (previousActiveElementRef.current) {
      previousActiveElementRef.current.focus()
      previousActiveElementRef.current = null
    }
  }, [handleKeyDown])

  // Handle isActive prop changes
  useEffect(() => {
    if (isActive) {
      activate()
    } else {
      deactivate()
    }
  }, [isActive, activate, deactivate])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      deactivate()
    }
  }, [deactivate])

  return {
    containerRef,
    activate,
    deactivate,
  }
}
