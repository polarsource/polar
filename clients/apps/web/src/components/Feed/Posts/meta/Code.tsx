import { CodePost } from '../../data'

export const CodeMeta = (post: CodePost) => {
  return (
    <pre className="max-h-[280px] w-full overflow-auto p-4 text-xs">
      {post.code.code}
    </pre>
  )
}
