'use client'

import { evaluate } from '@mdx-js/mdx'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextArea,
} from 'polarkit/components/ui/atoms'
import { ChangeEventHandler, useCallback, useEffect, useState } from 'react'
import * as runtime from 'react/jsx-runtime'

interface EditorProps {
  value: string
  onChange?: (value: string) => void
}

const Editor = ({ value, onChange }: EditorProps) => {
  /** @ts-ignore */
  const [MDXContent, setMDXContent] = useState<MDXContent>()

  useEffect(() => {
    const asyncEvaluate = async () => {
      const { default: MDXContent } = await evaluate(value, runtime)
      setMDXContent(
        MDXContent({
          components: {
            wrapper: (props) => <div className="my-4 my-4" {...props} />,
            h1: (props) => (
              <h1 className="my-4 text-3xl font-bold" {...props} />
            ),
            h2: (props) => (
              <h2 className="my-4 text-2xl font-bold" {...props} />
            ),
            h3: (props) => <h3 className="my-4 text-xl font-bold" {...props} />,
            h4: (props) => <h4 className="my-4 text-lg font-bold" {...props} />,
            h5: (props) => (
              <h5 className="my-4 text-base font-bold" {...props} />
            ),
            h6: (props) => <h6 className="my-4 text-sm font-bold" {...props} />,
            p: (props) => <p className="my-4 text-base" {...props} />,
            a: (props) => (
              <a className="my-4 text-base text-blue-500" {...props} />
            ),
            ul: (props) => <ul className="my-4 text-base" {...props} />,
            ol: (props) => <ol className="my-4 text-base" {...props} />,
            li: (props) => <li className="my-4 text-base" {...props} />,
            blockquote: (props) => (
              <blockquote className="my-4 text-base" {...props} />
            ),
            pre: (props) => <pre className="my-4 text-base" {...props} />,
            code: (props) => <code className="my-4 text-base" {...props} />,
            inlineCode: (props) => (
              <code className="my-4 text-base" {...props} />
            ),
            hr: (props) => <hr className="my-4 text-base" {...props} />,
            table: (props) => <table className="my-4 text-base" {...props} />,
            thead: (props) => <thead className="my-4 text-base" {...props} />,
            tbody: (props) => <tbody className="my-4 text-base" {...props} />,
            tr: (props) => <tr className="my-4 text-base" {...props} />,
            th: (props) => <th className="my-4 text-base" {...props} />,
            td: (props) => <td className="my-4 text-base" {...props} />,
            strong: (props) => <strong className="my-4 text-base" {...props} />,
            em: (props) => <em className="my-4 text-base" {...props} />,
            del: (props) => <del className="my-4 text-base" {...props} />,
            img: (props) => <img className="my-4 text-base" {...props} />,
            iframe: (props) => <iframe className="my-4 text-base" {...props} />,
            span: (props) => <span className="my-4 text-base" {...props} />,
            sup: (props) => <sup className="my-4 text-base" {...props} />,
          },
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
      <TabsList>
        <TabsTrigger value="edit">Markdown</TabsTrigger>
        <TabsTrigger value="preview">Preview</TabsTrigger>
      </TabsList>
      <TabsContent value="edit">
        <TextArea className="h-[400px]" value={value} onChange={handleChange} />
      </TabsContent>
      <TabsContent value="preview">{MDXContent}</TabsContent>
    </Tabs>
  )
}

export default Editor
