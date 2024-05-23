'use client'

import {
  FileRead,
  FileServiceTypes,
  FileUpload,
  Organization,
} from '@polar-sh/sdk'

import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload } from './Upload'

export interface FileObject extends FileRead {
  isUploading: boolean
  uploadedBytes: number
}

const buildFileObject = (file: FileRead): FileObject => {
  return {
    ...file,
    isUploading: false,
    uploadedBytes: file.is_uploaded ? file.size : 0,
  }
}

const buildFileObjects = (files: FileRead[]): FileObject[] => {
  return files.map(buildFileObject)
}

interface FileUploadProps {
  service: FileServiceTypes
  organization: Organization
  initialFiles: FileRead[]
  onFilesUpdated: (files: FileObject[]) => void
}

export const useFileUpload = ({
  service,
  organization,
  onFilesUpdated,
  initialFiles = [],
}: FileUploadProps) => {
  const [files, setFilesState] = useState<FileObject[]>(
    buildFileObjects(initialFiles),
  )

  const setFiles = (callback: (prev: FileObject[]) => FileObject[]) => {
    setFilesState((prev) => {
      const updated = callback(prev)
      if (onFilesUpdated) {
        onFilesUpdated(updated)
      }
      return updated
    })
  }

  const updateFile = (
    fileId: string,
    callback: (prev: FileObject) => FileObject,
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
    const newFile = buildFileObject(response)
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
          const upload = new Upload({
            service,
            organization,
            file,
            buffer,
            onFileCreate,
            onFileUploadProgress,
            onFileUploaded,
          })
          await upload.run()
        }
      }
      reader.readAsArrayBuffer(file)
    }
  }
  const dropzone = useDropzone({
    onDrop,
  })

  return {
    files,
    setFiles,
    updateFile,
    ...dropzone,
  }
}
