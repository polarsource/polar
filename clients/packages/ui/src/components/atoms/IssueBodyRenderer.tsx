import DOMPurify from 'dompurify'
import React from 'react'

interface IssueBodyRendererProps {
  body: string
  className?: string
}

export const IssueBodyRenderer: React.FC<IssueBodyRendererProps> = ({
  body,
  className,
}) => {
  const sanitizedBody = DOMPurify.sanitize(body)
  
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedBody }}
    />
  )
}
