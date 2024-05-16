'use client'

import { FileRead, Organization } from '@polar-sh/sdk'
import { useDropzone } from 'react-dropzone'
import { upload } from './Upload'

const Dropzone = ({
  organization,
  onUploaded,
}: {
  organization: Organization
  onUploaded: (file: FileRead) => void
}) => {
  const onSuccess = (response: FileRead) => {
    onUploaded(response)
  }

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles) => {
      for (const file of acceptedFiles) {
        const reader = new FileReader()
        reader.onload = async () => {
          const buffer = reader.result
          if (buffer instanceof ArrayBuffer) {
            await upload({ organization, file, buffer, onSuccess })
          }
        }
        reader.readAsArrayBuffer(file)
      }
    },
  })

  return (
    <>
      <div
        {...getRootProps({
          className: 'bg-gray-75 border-blue w-72 h-72',
        })}
      >
        <input {...getInputProps()} />
        <p>Drop it like it&apos;s hot</p>
      </div>
    </>
  )
}

export default Dropzone
