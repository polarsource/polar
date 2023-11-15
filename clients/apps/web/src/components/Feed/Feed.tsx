import { Post } from './Post'
import { posts } from './data'

export const Feed = () => {
  return (
    <div className="flex flex-col gap-y-2">
      {posts.map((post) => (
        <Post key={post.slug} {...post} />
      ))}
    </div>
  )
}
