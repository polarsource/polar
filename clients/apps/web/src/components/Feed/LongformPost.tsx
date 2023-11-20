'use client'

import { COMPONENTS } from '@/components/Feed/Editor'
import { Post } from '@/components/Feed/data'
import { StaggerReveal } from '@/components/Shared/StaggerReveal'
import { Avatar } from 'polarkit/components/ui/atoms'
// @ts-ignore
import Markdown from 'react-markdown'
import { twMerge } from 'tailwind-merge'
// @ts-ignore
import { visit } from 'unist-util-visit'

const staggerTransition = {
  staggerChildren: 0.2,
}

const revealTransition = {
  duration: 1,
}

export default function LongformPost({ post }: { post: Post }) {
  return (
    <StaggerReveal className="max-w-2xl" transition={staggerTransition}>
      <div className="flex flex-col items-center gap-y-16 pb-16 pt-8">
        <StaggerReveal.Child transition={revealTransition}>
          <span className="dark:text-polar-500 text-gray-500">
            {post.createdAt.toLocaleString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </StaggerReveal.Child>
        <StaggerReveal.Child transition={revealTransition}>
          <h1 className="text-center text-4xl font-bold leading-relaxed">
            {post.title}
          </h1>
        </StaggerReveal.Child>
        <StaggerReveal.Child transition={revealTransition}>
          <div className="flex flex-row items-center gap-x-3">
            <Avatar
              className="h-8 w-8"
              avatar_url={post.author.avatar_url}
              name={post.author.username}
            />
            <h3 className="text-md dark:text-polar-50">
              {post.author.username}
            </h3>
          </div>
        </StaggerReveal.Child>
      </div>
      <StaggerReveal.Child transition={revealTransition}>
        <Markdown
          className="relative leading-relaxed"
          components={COMPONENTS}
          rehypePlugins={[
            () => (tree) => {
              visit(tree, 'element', (node, index, parent) => {
                node.properties = {
                  ...node.properties,
                  className: twMerge(
                    node.properties?.className,
                    node.tagName === 'img' ||
                      (node.tagName === 'p' &&
                        node.children[0].tagName === 'img')
                      ? 'w-full my-12'
                      : undefined,
                  ),
                }
              })
            },
          ]}
        >
          {post.body}
        </Markdown>
      </StaggerReveal.Child>
    </StaggerReveal>
  )
}
