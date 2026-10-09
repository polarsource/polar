'use client'

import VolumeOff from '@mui/icons-material/VolumeOff'
import VolumeUp from '@mui/icons-material/VolumeUp'
import { Stream, StreamPlayerApi } from '@cloudflare/stream-react'
import { Box } from '@polar-sh/orbit/Box'
import { useCallback, useEffect, useRef, useState } from 'react'

const LOGO_VIDEO_ID = 'd4e6d6f9f184a80ee8db27577897e626'
const IN_VIEW_THRESHOLD = 0.5

export const LogoVideo = () => {
  const [muted, setMuted] = useState(true)
  const [inView, setInView] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<StreamPlayerApi | undefined>(undefined)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: IN_VIEW_THRESHOLD },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const syncPlayback = useCallback(() => {
    const player = streamRef.current
    if (!player) return
    if (inView) {
      player.play()
    } else {
      player.pause()
    }
  }, [inView])

  useEffect(syncPlayback, [syncPlayback])

  return (
    <div ref={containerRef}>
      <Box
        display="block"
        position="relative"
        width="100%"
        overflow="hidden"
        backgroundColor="background-secondary"
      >
        <Stream
          src={LOGO_VIDEO_ID}
          streamRef={streamRef}
          controls={false}
          muted={muted}
          loop
          onCanPlay={syncPlayback}
        />
        <button
          type="button"
          onClick={() => setMuted((value) => !value)}
          aria-label={muted ? 'Unmute video' : 'Mute video'}
          aria-pressed={!muted}
          className="absolute top-4 right-4 z-10 flex h-16 w-16 cursor-pointer items-center justify-center text-4xl text-white md:top-12 md:right-12 md:text-5xl"
        >
          {muted ? (
            <VolumeOff fontSize="inherit" />
          ) : (
            <VolumeUp fontSize="inherit" />
          )}
        </button>
      </Box>
    </div>
  )
}
