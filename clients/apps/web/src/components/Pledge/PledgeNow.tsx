const PledgeNow = ({ onClick }: { onClick: () => void }) => {
  return (
    <button
      className="w-full cursor-pointer rounded-lg bg-blue-500 px-2 py-1 text-sm font-medium text-gray-100 transition-colors duration-200 hover:bg-blue-500"
      onClick={onClick}
    >
      Fund
    </button>
  )
}

export default PledgeNow
