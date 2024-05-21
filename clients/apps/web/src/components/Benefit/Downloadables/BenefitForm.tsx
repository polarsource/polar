'use client'

import {
  BenefitDownloadablesCreate,
  FileRead,
  FileUpload,
  Organization,
} from '@polar-sh/sdk'

import { FileUploadOutlined as FileUploadIcon } from '@mui/icons-material'

import { Switch } from 'polarkit/components/ui/atoms'
import { ReactElement, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { upload } from './Upload'

interface Downloadable extends FileRead {
  enabled: boolean
  isUploaded: boolean
  isUploading: boolean
  uploadedBytes: number
}

const buildDownloadable = (file: FileRead): Downloadable => {
  const uploaded = file.uploaded_at !== null
  return {
    ...file,
    enabled: true,
    isUploaded: uploaded,
    isUploading: false,
    uploadedBytes: uploaded ? file.size : 0,
  }
}

const FilePreview = ({ file }: { file: Downloadable }) => {
  return (
    <div className="h-14 w-14 rounded bg-gray-200 text-gray-600">
      <p className="font-semibold">.{file.extension}</p>
    </div>
  )
}

const FileUploadProgress = ({ file }: { file: Downloadable }) => {
  const pct = Math.round((file.uploadedBytes / file.size) * 100)
  return (
    <>
      <div className="flex w-full items-center space-x-4">
        <div className="flex-grow">
          <div className="h-2 w-full rounded bg-gray-100">
            <div
              className="h-2 rounded bg-blue-400"
              style={{ width: `${pct}%` }}
            >
              &nbsp;
            </div>
          </div>
        </div>
        <div className="flex w-8">
          <p className="text-sm">{pct}%</p>
        </div>
      </div>
    </>
  )
}

const FileUploadDetails = ({ file }: { file: Downloadable }) => {
  return (
    <>
      <div className="text-gray-500">
        <p className="text-xs">
          <span className="font-medium">Size:</span> {file.size}
        </p>
        <p className="text-xs">
          <span className="font-medium">SHA-256:</span>{' '}
          {file.checksum_sha256_hex}
        </p>
      </div>
    </>
  )
}

const ManageFile = ({
  file,
  updateFile,
}: {
  file: Downloadable
  updateFile: (callback: (prev: Downloadable) => Downloadable) => void
}) => {
  console.log('file to manage', file)
  const onToggleEnabled = (enabled: boolean) => {
    updateFile((prev) => {
      return {
        ...prev,
        enabled,
      }
    })
  }

  const isUploading = file.isUploading

  return (
    <>
      <div className="mb-4 flex items-center space-x-4">
        <div className="flex w-14 text-center">
          <FilePreview file={file} />
        </div>
        <div className="flex-grow text-gray-700">
          <strong className="font-semibold">{file.name}</strong>
          {!isUploading && <FileUploadDetails file={file} />}
          {isUploading && <FileUploadProgress file={file} />}
        </div>
        {!isUploading && (
          <div className="flex w-14">
            <Switch checked={file.enabled} onCheckedChange={onToggleEnabled} />
          </div>
        )}
      </div>
    </>
  )
}

const ManageFileView = ({
  files,
  updateFile,
}: {
  files: Downloadable[]
  updateFile: (
    fileId: string,
    callback: (prev: Downloadable) => Downloadable,
  ) => void
}) => {
  const getUpdateScopedFile = (fileId: string) => {
    return (callback: (prev: Downloadable) => Downloadable) => {
      updateFile(fileId, callback)
    }
  }

  return (
    <ul>
      {files.map((file) => (
        <li key={file.id}>
          <ManageFile file={file} updateFile={getUpdateScopedFile(file.id)} />
        </li>
      ))}
    </ul>
  )
}

const DropzoneView = ({
  isDragActive,
  children,
}: {
  isDragActive: boolean
  children: ReactElement
}) => {
  return (
    <>
      <div
        className={twMerge(
          'flex w-full items-center justify-center border pb-8 pt-8',
          isDragActive ? 'border-blue-100 bg-blue-50' : 'bg-gray-50',
        )}
      >
        <div className="text-center text-gray-700">
          <div className="mb-4">
            <FileUploadIcon fontSize="large" />
          </div>
          <strong>
            {!isDragActive && 'Feed me some bytes'}
            {isDragActive && "Drop it like it's hot"}
          </strong>
          <p className="mt-2 text-sm">
            You can drop files here or{' '}
            <a className="text-blue-400">click like a Netscape user</a>
          </p>
        </div>
        {children}
      </div>
    </>
  )
}

interface DownloadablesBenefitFormProps {
  organization: Organization
  update?: boolean
}

export const DownloadablesBenefitForm = ({
  organization,
}: DownloadablesBenefitFormProps) => {
  const { setValue } = useFormContext<BenefitDownloadablesCreate>()
  /**
   * TODO
   *
   * Update design
   * Update benefit file properties to include enabled: true/false
   * Sortable files
   */

  const [files, setFilesState] = useState<Downloadable[]>([])

  const setFormFiles = (files: Downloadable[]) => {
    const property = []
    for (const file of files) {
      if (file.isUploaded) {
        property.push(file.id)
      }
    }
    setValue('properties.files', property)
  }

  const setFiles = (callback: (prev: Downloadable[]) => Downloadable[]) => {
    setFilesState((prev) => {
      const updated = callback(prev)
      setFormFiles(updated)
      return updated
    })
  }

  const updateFile = (
    fileId: string,
    callback: (prev: Downloadable) => Downloadable,
  ) => {
    setFiles((prev) => {
      return prev.map((f) => {
        if (f.id !== fileId) {
          return f
        }
        return callback(f)
      })
    })
  }

  const onFileCreate = (response: FileUpload) => {
    const newFile = buildDownloadable(response)
    newFile.isUploading = true
    setFiles((prev) => {
      return [...prev, newFile]
    })
  }

  const onFileUploaded = (response: FileRead) => {
    updateFile(response.id, (prev) => {
      return {
        ...prev,
        ...response,
        isUploaded: true,
        isUploading: false,
        uploadedBytes: response.size,
      }
    })
  }

  const onFileUploadProgress = (file: FileUpload, uploaded: number) => {
    updateFile(file.id, (prev) => {
      return {
        ...prev,
        uploadedBytes: uploaded,
      }
    })
  }

  const onDrop = (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const reader = new FileReader()
      reader.onload = async () => {
        const buffer = reader.result
        if (buffer instanceof ArrayBuffer) {
          await upload({
            organization,
            file,
            buffer,
            onFileCreate,
            onFileUploadProgress,
            onFileUploaded,
          })
        }
      }
      reader.readAsArrayBuffer(file)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
  })

  return (
    <>
      <div {...getRootProps()}>
        <DropzoneView isDragActive={isDragActive}>
          <input {...getInputProps()} />
        </DropzoneView>
      </div>
      <ManageFileView files={files} updateFile={updateFile} />
    </>
  )
}
