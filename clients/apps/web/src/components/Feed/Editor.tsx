'use client'

import { evaluate, UseMdxComponents } from '@mdx-js/mdx'
import { Root } from 'mdast'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextArea,
} from 'polarkit/components/ui/atoms'
import { ChangeEventHandler, useCallback, useEffect, useState } from 'react'
import * as runtime from 'react/jsx-runtime'
import { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

interface EditorProps {
  value: string
  onChange?: (value: string) => void
}

const Editor = ({ value, onChange }: EditorProps) => {
  /** @ts-ignore */
  const [MDXContent, setMDXContent] = useState<MDXContent>()

  useEffect(() => {
    const asyncEvaluate = async () => {
      const MDXContent = await evalMDX(value)
      setMDXContent(
        MDXContent({
          components: COMPONENTS,
        }),
      )
    }

    asyncEvaluate()
  }, [value])

  const handleChange: ChangeEventHandler<HTMLTextAreaElement> = useCallback(
    async (e) => {
      onChange?.(e.target.value)
    },
    [onChange],
  )

  return (
    <Tabs className="flex flex-col gap-y-6" defaultValue="edit">
      <TabsList className="dark:border-polar-700 dark:border">
        <TabsTrigger value="edit">Markdown</TabsTrigger>
        <TabsTrigger value="preview">Preview</TabsTrigger>
      </TabsList>
      <TabsContent value="edit">
        <TextArea
          className=" dark:bg-polar-800 dark:border-polar-700 text-md h-[400px] min-h-[400px] rounded-3xl border border-gray-100 bg-white p-8 shadow-xl"
          value={value}
          onChange={handleChange}
        />
      </TabsContent>
      <TabsContent value="preview">{MDXContent}</TabsContent>
    </Tabs>
  )
}

export default Editor

const rehypePlugin: Plugin<[], Root> = () => (ast) => {
  visit(ast, 'text', (node, index, parent) => {
    if ('value' in node && /(#\d+)/.test(node?.value)) {
      if (parent) {
        parent.tagName = 'issue'
      }
    }
  })
}

const evalMDX = async (value: string) => {
  // @ts-ignore
  const { default: MDXContent } = await evaluate(value, {
    ...runtime,
    /** 
     * Experimental plugin which can be used to inject custom elements into the MDX AST.
    rehypePlugins: [rehypePlugin],
    */
  })

  return MDXContent
}

const COMPONENTS: ReturnType<UseMdxComponents> = {
  wrapper: (props) => (
    <div
      className="dark:bg-polar-800 dark:border-polar-700 min-h-[400px] rounded-3xl border border-gray-100 bg-white px-8 pb-8 pt-2 shadow-xl"
      {...props}
    />
  ),
  h1: (props) => <h1 className="my-6 text-3xl font-bold" {...props} />,
  h2: (props) => <h2 className="my-6 text-2xl font-bold" {...props} />,
  h3: (props) => <h3 className="my-6 text-xl font-bold" {...props} />,
  h4: (props) => <h4 className="my-6 text-lg font-bold" {...props} />,
  h5: (props) => <h5 className="my-6 text-base font-bold" {...props} />,
  h6: (props) => <h6 className="my-6 text-sm font-bold" {...props} />,
  p: (props) => <p className="my-6 text-base" {...props} />,
  a: (props) => (
    <a
      className="my-6 text-base text-blue-500"
      rel="noopener noreferrer"
      target="_blank"
      {...props}
    />
  ),
  ul: (props) => <ul className="my-6 text-base" {...props} />,
  ol: (props) => <ol className="my-6 text-base" {...props} />,
  li: (props) => <li className="my-6 text-base" {...props} />,
  blockquote: (props) => <blockquote className="my-6 text-base" {...props} />,
  pre: (props) => <pre className="my-6 text-base" {...props} />,
  code: (props) => <code className="my-6 text-base" {...props} />,
  inlineCode: (props) => <code className="my-6 text-base" {...props} />,
  hr: (props) => <hr className="my-6 text-base" {...props} />,
  table: (props) => <table className="my-6 text-base" {...props} />,
  thead: (props) => <thead className="my-6 text-base" {...props} />,
  tbody: (props) => <tbody className="my-6 text-base" {...props} />,
  tr: (props) => <tr className="my-6 text-base" {...props} />,
  th: (props) => <th className="my-6 text-base" {...props} />,
  td: (props) => <td className="my-6 text-base" {...props} />,
  strong: (props) => <strong className="my-6 text-base" {...props} />,
  em: (props) => <em className="my-6 text-base" {...props} />,
  del: (props) => <del className="my-6 text-base" {...props} />,
  img: (props) => <img className="my-6 text-base" {...props} />,
  iframe: (props) => <iframe className="my-6 text-base" {...props} />,
  span: (props) => <span className="my-6 text-base" {...props} />,
}
