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
            h1: (props) => <h1 className="text-3xl font-bold" {...props} />,
            h2: (props) => <h2 className="text-2xl font-bold" {...props} />,
            h3: (props) => <h3 className="text-xl font-bold" {...props} />,
            h4: (props) => <h4 className="text-lg font-bold" {...props} />,
            h5: (props) => <h5 className="text-base font-bold" {...props} />,
            h6: (props) => <h6 className="text-sm font-bold" {...props} />,
            p: (props) => <p className="text-base" {...props} />,
            a: (props) => <a className="text-base text-blue-500" {...props} />,
            ul: (props) => <ul className="text-base" {...props} />,
            ol: (props) => <ol className="text-base" {...props} />,
            li: (props) => <li className="text-base" {...props} />,
            blockquote: (props) => (
              <blockquote className="text-base" {...props} />
            ),
            pre: (props) => <pre className="text-base" {...props} />,
            code: (props) => <code className="text-base" {...props} />,
            inlineCode: (props) => <code className="text-base" {...props} />,
            hr: (props) => <hr className="text-base" {...props} />,
            table: (props) => <table className="text-base" {...props} />,
            thead: (props) => <thead className="text-base" {...props} />,
            tbody: (props) => <tbody className="text-base" {...props} />,
            tr: (props) => <tr className="text-base" {...props} />,
            th: (props) => <th className="text-base" {...props} />,
            td: (props) => <td className="text-base" {...props} />,
            strong: (props) => <strong className="text-base" {...props} />,
            em: (props) => <em className="text-base" {...props} />,
            del: (props) => <del className="text-base" {...props} />,
            img: (props) => <img className="text-base" {...props} />,
            iframe: (props) => <iframe className="text-base" {...props} />,
            span: (props) => <span className="text-base" {...props} />,
            sup: (props) => <sup className="text-base" {...props} />,
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
    <Tabs defaultValue="edit">
      <TabsList>
        <TabsTrigger value="edit">Edit</TabsTrigger>
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
