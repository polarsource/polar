import EmptyLayout from './EmptyLayout'

const PublicLayout = ({ children }: { children: React.ReactElement }) => {
  return (
    <EmptyLayout>
      <div className="mx-auto mt-12 mb-24 flex w-full flex-col space-y-12 px-2 md:max-w-[970px] md:px-0">
        {children}
      </div>
    </EmptyLayout>
  )
}

export default PublicLayout
