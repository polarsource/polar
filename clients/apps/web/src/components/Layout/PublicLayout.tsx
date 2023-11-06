import EmptyLayout from './EmptyLayout'

const PublicLayout = ({ children }: { children: React.ReactElement }) => {
  return (
    <EmptyLayout>
      <div className="mb:mt-12 mb:mb-24 mx-auto mb-16 mt-8 flex w-full max-w-6xl flex-col space-y-8 px-2 md:space-y-12 lg:px-0">
        {children}
      </div>
    </EmptyLayout>
  )
}

export default PublicLayout
