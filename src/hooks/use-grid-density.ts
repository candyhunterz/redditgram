'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

export type GridDensity = 'compact' | 'comfortable' | 'spacious'

interface DensityConfig {
  gap: number
  columns: {
    mobile: number
    tablet: number
    desktop: number
    wide: number
  }
  label: string
}

export const DENSITY_CONFIG: Record<GridDensity, DensityConfig> = {
  compact: {
    gap: 4,
    columns: {
      mobile: 3,
      tablet: 4,
      desktop: 6,
      wide: 8,
    },
    label: 'Compact',
  },
  comfortable: {
    gap: 8,
    columns: {
      mobile: 2,
      tablet: 3,
      desktop: 4,
      wide: 6,
    },
    label: 'Comfortable',
  },
  spacious: {
    gap: 16,
    columns: {
      mobile: 2,
      tablet: 2,
      desktop: 3,
      wide: 4,
    },
    label: 'Spacious',
  },
}

const DENSITY_STORAGE_KEY = 'gridDensity'
const DENSITY_ORDER: GridDensity[] = ['compact', 'comfortable', 'spacious']

function isValidDensity(value: string): value is GridDensity {
  return value === 'compact' || value === 'comfortable' || value === 'spacious'
}

export function useGridDensity() {
  const [density, setDensityState] = useState<GridDensity>('comfortable')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DENSITY_STORAGE_KEY)
      if (stored && isValidDensity(stored)) {
        setDensityState(stored)
      }
    } catch {
      // localStorage not available
    }
  }, [])

  const setDensity = useCallback((newDensity: GridDensity) => {
    setDensityState(newDensity)
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, newDensity)
    } catch {
      // localStorage not available
    }
  }, [])

  const cycleDensity = useCallback(() => {
    const currentIndex = DENSITY_ORDER.indexOf(density)
    const nextIndex = (currentIndex + 1) % DENSITY_ORDER.length
    setDensity(DENSITY_ORDER[nextIndex])
  }, [density, setDensity])

  const config = useMemo(() => DENSITY_CONFIG[density], [density])

  const gridStyle = useMemo(() => ({
    gap: `${config.gap}px`,
  }), [config.gap])

  return {
    density,
    setDensity,
    cycleDensity,
    config,
    gridStyle,
  }
}
