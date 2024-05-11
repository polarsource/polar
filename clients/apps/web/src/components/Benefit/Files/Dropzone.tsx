'use client'

import { FileRead, Organization } from '@polar-sh/sdk'

import { api } from '@/utils/api'
import { useRef } from 'react'

const Dropzone = ({
  organization,
  onUploaded,
}: {
  organization: Organization
  onUploaded: (file: FileRead) => void
}) => {
  const inputFileRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (image: string) => {
    if (!inputFileRef.current?.files) {
      throw new Error('No file selected')
    }

    if (image === undefined) {
      throw new Error('No image')
    }

    const file = inputFileRef.current.files[0]
    const params = {
      organization_id: organization.id,
      name: file.name,
      size: file.size,
      mime_type: file.type,
      version: null,
    }
    const response = await api.files.createFile({
      fileCreate: params,
    })

    const binary = atob(image.split(',')[1])
    const array = []
    for (var i = 0; i < binary.length; i++) {
      array.push(binary.charCodeAt(i))
    }

    let blob = new Blob([new Uint8Array(array)], { type: file.type })
    const result = await fetch(response.url, {
      method: 'PUT',
      body: blob,
    })

    if (!result.ok) {
      throw new Error('Failed to upload image')
    }

    const process = await api.files.markUploaded({
      fileId: response.id,
    })

    onUploaded(process)
  }

  return (
    <>
      <input
        name="file"
        ref={inputFileRef}
        type="file"
        required
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
          }
        }}
      />
    </>
  )
}

export default Dropzone
