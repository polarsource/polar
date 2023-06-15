const IssueConfirmButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <button
      className="mt-2 w-full cursor-pointer rounded-lg bg-blue-600 px-2 py-1 text-sm font-medium text-gray-100 transition-colors duration-200 hover:bg-blue-500"
      onClick={onClick}
    >
      Confirm
    </button>
  )
}

export default IssueConfirmButton
