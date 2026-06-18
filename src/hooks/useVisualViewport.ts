import { useEffect, useRef, useState } from 'react'

type VisualViewportState = {
  height: number | null
  offsetTop: number
  isKeyboardOpen: boolean
}

const keyboardThreshold = 140

const getBaselineHeight = () => {
  if (typeof window === 'undefined') {
    return 0
  }

  return Math.max(window.innerHeight, window.visualViewport?.height ?? 0)
}

const getViewportState = (baselineHeight: number): VisualViewportState => {
  if (typeof window === 'undefined') {
    return {
      height: null,
      offsetTop: 0,
      isKeyboardOpen: false,
    }
  }

  const viewport = window.visualViewport
  const height = viewport?.height ?? window.innerHeight
  const offsetTop = viewport?.offsetTop ?? 0
  const layoutHeight = window.innerHeight
  const visibleBaseline = Math.max(layoutHeight, baselineHeight)
  const hiddenHeight = visibleBaseline - height - offsetTop

  return {
    height,
    offsetTop,
    isKeyboardOpen: hiddenHeight > keyboardThreshold,
  }
}

export function useVisualViewport() {
  const baselineHeightRef = useRef(getBaselineHeight())
  const [viewportState, setViewportState] =
    useState<VisualViewportState>(() =>
      getViewportState(getBaselineHeight()),
    )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    let animationFrame = 0

    const updateViewportState = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(() => {
        const viewport = window.visualViewport
        const currentHeight = Math.max(
          window.innerHeight,
          viewport?.height ?? 0,
        )

        if (
          baselineHeightRef.current - currentHeight <= keyboardThreshold
        ) {
          baselineHeightRef.current = Math.max(
            baselineHeightRef.current,
            currentHeight,
          )
        }

        setViewportState(getViewportState(baselineHeightRef.current))
      })
    }

    const handleOrientationChange = () => {
      baselineHeightRef.current = getBaselineHeight()
      updateViewportState()
    }

    updateViewportState()
    window.visualViewport?.addEventListener('resize', updateViewportState)
    window.visualViewport?.addEventListener('scroll', updateViewportState)
    window.addEventListener('orientationchange', handleOrientationChange)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.visualViewport?.removeEventListener('resize', updateViewportState)
      window.visualViewport?.removeEventListener('scroll', updateViewportState)
      window.removeEventListener('orientationchange', handleOrientationChange)
    }
  }, [])

  return viewportState
}
