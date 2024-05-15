'use client'

import { api } from '@/utils/api'
import { FileRead, Organization } from '@polar-sh/sdk'

// Credit: https://codepen.io/dulldrums/pen/RqVrRr
const hex = (buffer: ArrayBuffer) => {
  var hexCodes = []
  var view = new DataView(buffer)
  for (var i = 0; i < view.byteLength; i += 4) {
    // Using getUint32 reduces the number of iterations needed (we process 4 bytes each time)
    var value = view.getUint32(i)
    // toString(16) will give the hex representation of the number without padding
    var stringValue = value.toString(16)
    // We use concatenation and slice for padding
    var padding = '00000000'
    var paddedValue = (padding + stringValue).slice(-padding.length)
    hexCodes.push(paddedValue)
  }

  // Join all the hex strings into one
  return hexCodes.join('')
}

const getSha256Hash = async (file: ArrayBuffer) => {
  const hash = await crypto.subtle.digest('SHA-256', file)
  return hash
}

const Dropzone = ({
  organization,
  onUploaded,
}: {
  organization: Organization
  onUploaded: (file: FileRead) => void
}) => {
  const handleUpload = async (file: File, buffer: ArrayBuffer) => {
    const sha256hash = await getSha256Hash(buffer)
    const sha256hex = hex(sha256hash)
    const base64hash = btoa(String.fromCharCode(...new Uint8Array(sha256hash)))

    const params = {
      organization_id: organization.id,
      name: file.name,
      size: file.size,
      mime_type: file.type,
      sha256: {
        base64: base64hash,
        hex: sha256hex,
      },
      version: null,
    }
    const response = await api.files.createFile({
      fileCreate: params,
    })

    let blob = new Blob([buffer], { type: file.type })

    const result = await fetch(response.url, {
      method: 'PUT',
      headers: response.headers,
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
        type="file"
        required
        multiple={true}
        tabIndex={-1}
        onChange={async (e) => {
          const files = e.target.files
          Array.from(files).forEach((file) => {
            const reader = new FileReader()
            reader.onload = async () => {
              const result = reader.result
              await handleUpload(file, result)
            }
            reader.readAsArrayBuffer(file)
          })
        }}
      />
    </>
  )
}

export default Dropzone
