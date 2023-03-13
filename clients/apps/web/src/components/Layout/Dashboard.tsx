import Sidebar from '../Dashboard/Sidebar'
import Topbar from '../Dashboard/Topbar'

const Layout = ({ children }) => {
  return (
    <div className="min-h-full bg-red-800">
      <Topbar />
      <div className="bg-blue-200">
        <Sidebar />
        <div className="flex flex-1 flex-col bg-white pt-16 md:pl-64">
          <main className="flex-1">
            <div className="py-6">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
export default Layout
