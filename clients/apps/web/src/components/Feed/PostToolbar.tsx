import { TabsList, TabsTrigger } from 'polarkit/components/ui/atoms'

export const PostToolbar = ({}) => {
  return (
    <div className="dark:border-polar-800 dark:bg-polar-900 fixed flex w-full flex-col border-b border-gray-100 bg-white">
      <div className="relative mx-auto flex w-full min-w-0 max-w-screen-xl flex-row items-center px-4 py-4 sm:px-6 md:px-8">
        <TabsList className="dark:border-polar-700 dark:border">
          <TabsTrigger value="edit" size="small">
            Markdown
          </TabsTrigger>
          <TabsTrigger value="preview" size="small">
            Preview
          </TabsTrigger>
        </TabsList>
      </div>
    </div>
  )
}
