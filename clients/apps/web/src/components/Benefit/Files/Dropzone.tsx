'use client'

import { api } from '@/utils/api'
import { useRef } from 'react'

const Dropzone = ({ onUploaded }: { onUploaded: (url: string) => void }) => {
  const inputFileRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (image: string) => {
    if (!inputFileRef.current?.files) {
      throw new Error('No file selected')
    }

    console.log('handleUpload')
    if (image === undefined) {
      throw new Error('No image')
    }

    // 1. Get signed S3 URL from our API
    const file = inputFileRef.current.files[0]
    console.log('file upload', file)
    console.log('api', api.files)

    const params = {
      name: file.name,
      size: file.size,
      type: file.type,
      last_modified_at: file.lastModifiedDate,
    }
    const response = await api.files.createFile({
      fileCreate: params,
    })
    console.log('response', response)

    // 2. Post to S3
    const binary = atob(image.split(',')[1])
    const array = []
    for (var i = 0; i < binary.length; i++) {
      array.push(binary.charCodeAt(i))
    }

    let blob = new Blob([new Uint8Array(array)], { type: file.type })
    console.log('Uploading to: ', response.url)
    const result = await fetch(response.url, {
      method: 'PUT',
      body: blob,
    })
    console.log('Result: ', result)
    // Final URL for the user doesn't need the query string params
    // this.uploadURL = response.uploadURL.split('?')[0]
  }

  return (
    <>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          await handleUpload()
        }}
      >
        <input
          name="file"
          ref={inputFileRef}
          type="file"
          required
          accept="image/*"
          tabIndex={-1}
          onChange={async (e) => {
            if (e.target.files && e.target.files[0]) {
              const reader = new FileReader()
              reader.onload = async (readerLoad) => {
                if (
                  readerLoad.target &&
                  typeof readerLoad.target.result === 'string'
                ) {
                  console.log('imageSet', readerLoad.target.result)
                  await handleUpload(readerLoad.target.result)
                }
              }
              reader.readAsDataURL(e.target.files[0])
            } else {
            }
          }}
        />
      </form>
    </>
  )
}

export default Dropzone
