import { Post } from './Post'
import { posts } from './data'

export const Feed = () => {
  return (
    <div className="dark:divide-polar-800 flex flex-col divide-y">
      {posts.map((post, index) => (
        <Post key={index} {...post} />
      ))}
    </div>
  )
}
