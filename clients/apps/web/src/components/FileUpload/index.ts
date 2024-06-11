'use client'

import {
  FileRead,
  FileServiceTypes,
  FileUpload,
  Organization,
} from '@polar-sh/sdk'

import { useState } from 'react'
import { Accept, FileRejection, useDropzone } from 'react-dropzone'
import { Upload } from './Upload'

export type FileObject<
  T extends FileRead | FileUpload = FileRead | FileUpload,
> = T & {
  isUploading: boolean
  uploadedBytes: number
  buffer?: ArrayBuffer
}

const buildFileObject = <T extends FileRead | FileUpload>(
  file: T,
  buffer?: ArrayBuffer,
): FileObject<T> => {
  return {
    ...file,
    buffer,
    isUploading: false,
    uploadedBytes: file.is_uploaded ? file.size : 0,
  }
}

const buildFileObjects = <T extends FileRead | FileUpload>(
  files: T[],
): FileObject<T>[] => {
  return files.map((file) => buildFileObject(file))
}

interface FileUploadProps<T extends FileRead | FileUpload> {
  service: FileServiceTypes
  accept?: Accept
  maxSize?: number
  organization: Organization
  initialFiles: FileRead[]
  onFilesUpdated: (files: FileObject<T>[]) => void
  onFilesRejected?: (rejections: FileRejection[]) => void
}

export const useFileUpload = <T extends FileRead | FileUpload>({
  service,
  accept,
  maxSize,
  organization,
  onFilesUpdated,
  onFilesRejected,
  initialFiles = [],
}: FileUploadProps<T>) => {
  const [files, setFilesState] = useState<FileObject<T>[]>(
    buildFileObjects(initialFiles) as unknown as FileObject<T>[],
  )

  const setFiles = (callback: (prev: FileObject<T>[]) => FileObject<T>[]) => {
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
    callback: (prev: FileObject<T>) => FileObject<T>,
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

  const removeFile = (fileId: string) => {
    setFiles((prev) => {
      return prev.filter((file) => file.id !== fileId)
    })
  }

  const onFileCreate = (response: FileUpload, buffer: ArrayBuffer) => {
    const newFile = buildFileObject(response, buffer)
    newFile.isUploading = true
    setFiles((prev) => {
      return [...prev, newFile as unknown as FileObject<T>]
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

  const onDrop = (acceptedFiles: File[], fileRejections: FileRejection[]) => {
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

    if (onFilesRejected) {
      onFilesRejected(fileRejections)
    }
  }

  const dropzone = useDropzone({
    maxSize,
    accept,
    onDrop,
  })

  return {
    files,
    setFiles,
    updateFile,
    removeFile,
    ...dropzone,
  }
}
