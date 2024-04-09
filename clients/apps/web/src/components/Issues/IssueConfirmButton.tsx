const IssueConfirmButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <button
      className="text-sm font-medium text-blue-500 hover:text-blue-500"
      onClick={onClick}
    >
      Mark as solved
    </button>
  )
}

export default IssueConfirmButton
