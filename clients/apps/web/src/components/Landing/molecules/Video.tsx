'use client'

import { VolumeMute, VolumeUp } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

interface VideoProps {
  src: string
}

const videoVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 2 } },
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
      className="relative aspect-video w-full overflow-hidden rounded-3xl"
    >
      <motion.video
        ref={videoRef}
        src={src}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        loop
        muted={isMuted}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: false }}
        variants={videoVariants}
      />
      <div className="absolute right-8 top-8 hidden cursor-pointer md:block">
        {isMuted ? (
          <VolumeMute onClick={() => setIsMuted(false)} fontSize="large" />
        ) : (
          <VolumeUp onClick={() => setIsMuted(true)} fontSize="large" />
        )}
      </div>
    </div>
  )
}
