import RepoSelection from './RepoSelection'

const Topbar = () => {
  return (
    <div className="fixed z-10 flex h-16 w-full items-center justify-between bg-white px-4 drop-shadow">
      <div className="flex flex-1 items-center space-x-4 ">
        <RepoSelection />

        <div className="flex items-center space-x-3 rounded-full border-2 border-[#E5DEF5] bg-[#F9F7FD] py-1 pr-1.5 pl-3 text-[#7556BA]">
          <span>$123.40</span>
          <div className="h-[22px] w-[22px] rounded-full bg-[#9171D9]"></div>
        </div>
        <span className="text-xl">⚙️</span>
      </div>

      <div className=" font-semibold text-gray-700">Polar</div>

      <div className="flex flex-1 justify-end space-x-4">
        <span className="text-xl">🔔</span>
        <span className="text-xl">🔥</span>
      </div>
    </div>
  )
}
export default Topbar
