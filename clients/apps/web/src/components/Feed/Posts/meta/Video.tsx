import { PlayArrow } from '@mui/icons-material'
import { VideoPost } from '../../data'

export const VideoMeta = (post: VideoPost) => {
  return (
    <div className="flex w-full flex-col">
      <div
        className="relative flex h-[260px] w-full flex-col items-center justify-center bg-cover bg-center text-white"
        style={{ backgroundImage: `url(${post.video.thumbnailUrl})` }}
      >
        <span className="z-10 text-5xl">
          <PlayArrow fontSize="inherit" />
        </span>
        <div className="absolute inset-0 bg-[rgba(0_0_0_/_.8)]" />
      </div>

      <div className="flex flex-col gap-y-3 p-4">
        <div className="flex flex-col gap-y-1">
          <h4 className="dark:text-polar-50 font-medium text-gray-950">
            {post.video.title}
          </h4>
          <p className="dark:text-polar-500 truncate text-gray-500">
            {post.video.description}
          </p>
        </div>
      </div>
    </div>
  )
}
