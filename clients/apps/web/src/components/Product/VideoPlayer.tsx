import {
  FullscreenRounded,
  PauseRounded,
  PlayArrowRounded,
  VolumeUpRounded,
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import {
  DetailedHTMLProps,
  HTMLAttributes,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { twMerge } from 'tailwind-merge'

export interface VideoPlayerProps {
  source: string
}

export const VideoPlayer = ({ source }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [time, setTime] = useState(0)

  useEffect(() => {
    const onPlay = () => {
      setIsPlaying(true)
      setTime(videoRef.current?.currentTime ?? 0)
    }

    const onPause = () => {
      setIsPlaying(false)
    }

    const onTimeUpdate = () => {
      setTime(videoRef.current?.currentTime ?? 0)
    }

    const onLoad = () => {
      setDuration(Math.floor(videoRef.current?.duration ?? 0))
    }

    videoRef.current?.addEventListener('play', onPlay)
    videoRef.current?.addEventListener('pause', onPause)
    videoRef.current?.addEventListener('timeupdate', onTimeUpdate)
    videoRef.current?.addEventListener('loadeddata', onLoad)

    return () => {
      videoRef.current?.removeEventListener('play', onPlay)
      videoRef.current?.removeEventListener('pause', onPause)
      videoRef.current?.removeEventListener('timeupdate', onTimeUpdate)
      videoRef.current?.removeEventListener('loadeddata', onLoad)
    }
  }, [])

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (videoRef.current instanceof HTMLVideoElement) {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const percentage = x / rect.width
        const time = percentage * duration
        videoRef.current.currentTime = time
      }
    },
    [duration],
  )

  const togglePlay = useCallback(() => {
    if (videoRef.current?.paused) {
      videoRef.current?.play()
    } else {
      videoRef.current?.pause()
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (videoRef.current instanceof HTMLVideoElement) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen()
      } else if (videoRef.current.webkitRequestFullscreen) {
        videoRef.current.webkitRequestFullscreen()
      } else if (videoRef.current.mozRequestFullScreen) {
        videoRef.current.mozRequestFullScreen()
      } else if (videoRef.current.msRequestFullscreen) {
        videoRef.current.msRequestFullscreen()
      }
    }
  }, [])

  const segments = useMemo(() => Math.round(Math.random() * 10), [])

  return (
    <div className="relative overflow-hidden rounded-3xl">
      <video ref={videoRef} className="relative aspect-video">
        <source src={source} type="video/mp4" />
      </video>
      <div className="absolute inset-0 flex w-full flex-col justify-end">
        <div className="flex flex-col gap-y-6 bg-gradient-to-t from-black/90 from-50% to-transparent p-8 pt-16">
          <div
            className="relative flex h-1 w-full flex-row items-center justify-stretch gap-x-2 overflow-hidden rounded-full"
            onClick={handleSeek}
          >
            <motion.div
              className="absolute bottom-0 left-0 top-0 z-10 bg-blue-500 bg-clip-content dark:bg-white"
              initial={{ width: 0 }}
              animate={{
                width: `${(time / duration) * 100}%`,
                transition: { ease: 'linear', duration: 0.4 },
              }}
            />
            {Array(segments)
              .fill(0)
              .map((_, i) => (
                <div
                  key={i}
                  className="h-full w-full flex-grow rounded-full bg-black/20 backdrop-blur-sm dark:bg-white/20"
                />
              ))}
          </div>
          <div className="flex flex-row items-center justify-between text-3xl">
            <div className="flex flex-row items-center gap-x-4">
              <ControlButton onClick={togglePlay}>
                {isPlaying ? (
                  <PauseRounded fontSize="inherit" />
                ) : (
                  <PlayArrowRounded fontSize="inherit" />
                )}
              </ControlButton>
              <ControlButton>
                <VolumeUpRounded fontSize="inherit" />
              </ControlButton>
              <span className="h-full text-sm">
                {formatTime(Math.floor(time))} / {formatTime(duration)}
              </span>
            </div>
            <ControlButton onClick={toggleFullscreen}>
              <FullscreenRounded fontSize="inherit" />
            </ControlButton>
          </div>
        </div>
      </div>
    </div>
  )
}

const ControlButton = ({
  className,
  ...props
}: DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>) => {
  return (
    <div
      className={twMerge('flex cursor-pointer flex-col', className)}
      {...props}
    />
  )
}

const formatTime = (time: number) => {
  let hours: number | string = Math.floor(time / 3600)
  let minutes: number | string = Math.floor((time - hours * 3600) / 60)
  let seconds: number | string = time - hours * 3600 - minutes * 60

  if (minutes < 10) {
    minutes = '0' + minutes
  }
  if (seconds < 10) {
    seconds = '0' + seconds
  }

  if (hours < 1) {
    return minutes + ':' + seconds
  }

  if (hours < 10) {
    hours = '0' + hours
  }

  return hours + ':' + minutes + ':' + seconds
}
