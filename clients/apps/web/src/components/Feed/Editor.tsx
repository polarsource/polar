'use client'

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextArea,
} from 'polarkit/components/ui/atoms'
import { ChangeEventHandler, useCallback } from 'react'
// @ts-ignore
import Markdown, { Components } from 'react-markdown'

interface EditorProps {
  value: string
  onChange?: (value: string) => void
}

const Editor = ({ value, onChange }: EditorProps) => {
  const handleChange: ChangeEventHandler<HTMLTextAreaElement> = useCallback(
    async (e) => {
      onChange?.(e.target.value)
    },
    [onChange],
  )

  return (
    <Tabs className="flex h-full flex-col gap-y-6" defaultValue="edit">
      <TabsList className="dark:border-polar-700 dark:border">
        <TabsTrigger value="edit">Markdown</TabsTrigger>
        <TabsTrigger value="preview">Preview</TabsTrigger>
      </TabsList>
      <TabsContent className="h-full" value="edit">
        <TextArea
          className="text-md h-full min-h-[600px] rounded-3xl p-6"
          resizable={false}
          value={value}
          onChange={handleChange}
        />
      </TabsContent>
      <TabsContent value="preview">
        <Markdown components={COMPONENTS}>{value}</Markdown>
      </TabsContent>
    </Tabs>
  )
}

export default Editor

const COMPONENTS: Components = {
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
  ul: (props) => <ul className="my-6 list-disc text-base" {...props} />,
  ol: (props) => <ol className="my-6 list-decimal text-base" {...props} />,
  li: (props) => <li className="my-1 text-base" {...props} />,
  blockquote: (props) => <blockquote className="my-6 text-base" {...props} />,
  pre: (props) => (
    <pre
      className="dark:bg-polar-800 my-6 rounded-2xl bg-gray-50 p-6 text-base"
      {...props}
    />
  ),
  code: (props) => <code className="my-6 text-base" {...props} />,
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
