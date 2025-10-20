'use client'

import VolumeMute from '@mui/icons-material/VolumeMute'
import VolumeUp from '@mui/icons-material/VolumeUp'
import { useEffect, useRef, useState } from 'react'

interface VideoProps {
  src: string
}

export const Video = ({ src }: VideoProps) => {
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isMuted, setIsMuted] = useState(true)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (videoRef.current) {
            if (entry.isIntersecting) {
              videoRef.current.play()
            } else {
              videoRef.current.pause()
            }
          }
        })
      },
      { threshold: 0.2 },
    )

    if (videoRef.current) {
      observer.observe(videoRef.current)
    }

    return () => {
      if (videoRef.current) {
        observer.unobserve(videoRef.current)
      }
    }
  }, [])

  return (
    <div
      ref={videoContainerRef}
      className="relative aspect-video w-full overflow-hidden rounded-xl md:rounded-3xl"
    >
      <video
        ref={videoRef}
        src={src}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        loop
        playsInline
        muted={isMuted}
      />
      <div className="absolute top-8 right-8 hidden cursor-pointer md:block">
        {isMuted ? (
          <VolumeMute onClick={() => setIsMuted(false)} fontSize="large" />
        ) : (
          <VolumeUp onClick={() => setIsMuted(true)} fontSize="large" />
        )}
      </div>
    </div>
  )
}
