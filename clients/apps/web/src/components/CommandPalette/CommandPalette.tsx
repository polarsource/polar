'use client'

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms/tabs'
import { useContextualDocs } from './useContextualDocs'

export interface CommandPaletteProps {}

export const CommandPalette = ({}: CommandPaletteProps) => {
  const contextualDocs = useContextualDocs()

  return (
    <div className="dark:bg-polar-700 bg-gray-75 flex h-[520px] w-full flex-grow flex-col">
      <div className="dark:bg-polar-800 bg-white p-8">
        <input
          className="dark:text-polar-50 dark:placeholder:text-polar-500 w-full border-none bg-transparent p-0 text-xl text-gray-950 placeholder:text-gray-500 focus:border-none focus:outline-none focus:ring-0"
          placeholder="Enter Command..."
          autoFocus
        />
      </div>
      <div className="flex h-full flex-row gap-x-4 p-4">
        <div className="dark:bg-polar-700 flex h-full w-full max-w-64 flex-col overflow-y-scroll">
          <CommandItem
            command="List Issues"
            description="This is a long description"
          />
        </div>
        <div className="dark:bg-polar-800 flex w-full flex-col rounded-2xl bg-white p-6">
          <Tabs defaultValue="curl">
            <TabsList>
              <TabsTrigger value="curl" size="small">
                cURL
              </TabsTrigger>
              <TabsTrigger value="nodejs" size="small">
                NodeJS
              </TabsTrigger>
              <TabsTrigger value="python" size="small">
                Python
              </TabsTrigger>
              <TabsTrigger value="go" size="small">
                Go
              </TabsTrigger>
            </TabsList>
            <TabsContent value="curl" className="p-2">
              <pre className="font-mono text-sm">
                {`curl -X GET \ 
-H "Content-type: application/json" \ 
-H "Accept: application/json" \ 
-H "Authorization: Bearer <token>" \ 
https://api.polar.sh/api/v1/issues/for_you`}
              </pre>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

export interface CommandItemProps {
  command: string
  description: string
}

const CommandItem = ({ command, description }: CommandItemProps) => {
  return (
    <div className="dark:bg-polar-900 flex flex-col rounded-xl bg-white px-4 py-3 text-sm">
      <h3 className="dark:text-polar-50 font-medium text-gray-950">
        {command}
      </h3>
      <p className="dark:text-polar-400 text-gray-500">{description}</p>
    </div>
  )
}
