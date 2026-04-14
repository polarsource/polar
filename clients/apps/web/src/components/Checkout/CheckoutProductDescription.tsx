'use client'

import { Modal } from '@/components/Modal'
import { markdownOptions } from '@/utils/markdown'
import { AcceptedLocale, useTranslations } from '@polar-sh/i18n'
import Markdown from 'markdown-to-jsx'
import { useEffect, useRef, useState } from 'react'

const proseClassName =
  'prose dark:prose-invert prose-headings:mt-4 prose-headings:font-medium prose-headings:text-black prose-h1:text-xl prose-h2:text-lg prose-h3:text-md dark:prose-headings:text-white dark:text-polar-300 leading-normal text-gray-800'

export const CheckoutProductDescription = ({
  description,
  productName,
  locale,
}: {
  description: string
  productName: string
  locale: AcceptedLocale
}) => {
  const t = useTranslations(locale)
  const textRef = useRef<HTMLDivElement>(null)
  const [isClamped, setIsClamped] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    const el = textRef.current
    if (!el) return

    const checkClamped = () => {
      requestAnimationFrame(() => {
        setIsClamped(el.scrollHeight > el.clientHeight + 1)
      })
    }

    checkClamped()
    window.addEventListener('resize', checkClamped)
    return () => window.removeEventListener('resize', checkClamped)
  }, [description])

  return (
    <>
      <hr className="dark:border-polar-700 border-gray-200" />
      <div className="flex flex-col gap-y-2">
        <div
          ref={textRef}
          id="description"
          className={`${proseClassName} line-clamp-4 md:line-clamp-none`}
        >
          <Markdown options={markdownOptions}>{description}</Markdown>
        </div>
        {isClamped && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="dark:text-polar-300 dark:hover:text-polar-200 cursor-pointer self-start text-sm text-gray-500 hover:text-gray-700 md:hidden"
          >
            {t('checkout.productDescription.readMore')}
          </button>
        )}
      </div>
      <Modal
        title={productName}
        isShown={isModalOpen}
        hide={() => setIsModalOpen(false)}
        modalContent={
          <div className={`${proseClassName} p-6`}>
            <Markdown options={markdownOptions}>{description}</Markdown>
          </div>
        }
      />
    </>
  )
}
