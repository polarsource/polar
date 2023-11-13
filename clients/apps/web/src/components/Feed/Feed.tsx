import { Post } from './Post'
import { posts } from './data'

export const Feed = () => {
  return (
    <div className="flex flex-col divide-y">
      {posts.map((post) => (
        <Post key={post.text} {...post} />
      ))}
    </div>
  )
}
