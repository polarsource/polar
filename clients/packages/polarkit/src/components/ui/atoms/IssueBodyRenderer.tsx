interface IssueBodyRendererProps {
  html: string
}

const IssueBodyRenderer: React.FC<IssueBodyRendererProps> = ({ html }) => {
  /* See: https://tailwindcss.com/docs/typography-plugin */
  return (
    <div className="prose dark:prose-invert prose-headings:my-2 prose-pre:bg-gray-100 prose-pre:text-black dark:prose-pre:bg-gray-700 dark:prose-pre:text-white prose-code:before:content-[''] prose-code:after:content-[''] prose-code:bg-gray-100 dark:prose-code:bg-gray-700 prose-code:font-normal prose-code:p-1 prose-code:rounded max-w-none">
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

export default IssueBodyRenderer
