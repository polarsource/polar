'use client'

import {
  FileRead,
  FileServiceTypes,
  FileUpload,
  Organization,
} from '@polar-sh/sdk'

import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { upload } from './Upload'

export interface FileObject extends FileRead {
  enabled: boolean
  isUploaded: boolean
  isUploading: boolean
  uploadedBytes: number
}

const buildFileObject = (file: FileRead): FileObject => {
  const uploaded = file.last_modified_at !== null
  return {
    ...file,
    enabled: true,
    isUploaded: uploaded,
    isUploading: false,
    uploadedBytes: uploaded ? file.size : 0,
  }
}

interface FileUploadProps {
  service: FileServiceTypes
  organization: Organization
  onFilesUpdated: (files: FileObject[]) => void
}

export const useFileUpload = ({
  service,
  organization,
  onFilesUpdated,
}: FileUploadProps) => {
  const [files, setFilesState] = useState<FileObject[]>([])

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
