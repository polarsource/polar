'use client'

import ImageUpload from '@/components/Form/ImageUpload'
import { useState } from 'react'

export default function AvatarUploadPage() {
  const [url, setUrl] = useState<string | undefined>()

  return (
    <>
      <h1>Test Blob Uploads</h1>

      <ImageUpload onUploaded={setUrl} />

      {url && (
        <div>
          Blob url: <a href={url}>{url}</a>
        </div>
      )}
    </>
  )
}
