'use client'

import { Modal } from '@/components/Modal'
import { markdownOptions } from '@/utils/markdown'
import Markdown from 'markdown-to-jsx'
import { useEffect, useRef, useState } from 'react'

export const CheckoutTruncatedDescription = ({
  description,
  productName,
  readMoreLabel,
}: {
  description: string
  productName: string
  readMoreLabel: string
}) => {
  const textRef = useRef<HTMLDivElement>(null)
  const [isClamped, setIsClamped] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    const el = textRef.current
    if (!el) return
    requestAnimationFrame(() => {
      setIsClamped(el.scrollHeight > el.clientHeight)
    })
  }, [description])

  return (
    <>
      <div className="flex flex-col gap-y-1">
        <div
          ref={textRef}
          className="prose dark:prose-invert prose-headings:text-xs prose-p:text-xs prose-ul:text-xs prose-ol:text-xs dark:text-polar-400 line-clamp-2 max-w-none text-left text-xs text-gray-600"
        >
          <Markdown options={markdownOptions}>{description}</Markdown>
        </div>
        {isClamped && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="dark:text-polar-300 dark:hover:text-polar-200 cursor-pointer self-start text-xs text-gray-500 hover:text-gray-700"
          >
            {readMoreLabel}
          </button>
        )}
      </div>
      <Modal
        title={productName}
        isShown={isModalOpen}
        hide={() => setIsModalOpen(false)}
        modalContent={
          <div className="prose dark:prose-invert prose-headings:mt-4 prose-headings:font-medium prose-headings:text-black prose-h1:text-xl prose-h2:text-lg prose-h3:text-md dark:prose-headings:text-white dark:text-polar-300 p-6 leading-normal text-gray-800">
            <Markdown options={markdownOptions}>{description}</Markdown>
          </div>
        }
      />
    </>
  )
}
