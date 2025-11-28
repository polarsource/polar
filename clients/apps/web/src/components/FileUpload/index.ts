'use client'

import { schemas } from '@polar-sh/client'
import { useState } from 'react'
import { Accept, FileRejection, useDropzone } from 'react-dropzone'
import { FileRead, Upload } from './Upload'

export type FileObject<
  T extends FileRead | schemas['FileUpload'] = FileRead | schemas['FileUpload'],
> = T & {
  isProcessing: boolean
  isUploading: boolean
  uploadedBytes: number
  file?: File
}

const buildFileObject = <T extends FileRead | schemas['FileUpload']>(
  file: T,
): FileObject<T> => {
  return {
    ...file,
    isProcessing: false,
    isUploading: false,
    uploadedBytes: file.is_uploaded ? file.size : 0,
  }
}

const buildFileObjects = <T extends FileRead | schemas['FileUpload']>(
  files: T[],
): FileObject<T>[] => {
  return files.map((file) => buildFileObject(file))
}

interface FileUploadProps<T extends FileRead | schemas['FileUpload']> {
  service: schemas['FileServiceTypes']
  accept?: Accept
  maxSize?: number
  organization: schemas['Organization']
  initialFiles: FileRead[]
  onFilesUpdated: (files: FileObject<T>[]) => void
  onFilesRejected?: (rejections: FileRejection[]) => void
}

export const useFileUpload = <T extends FileRead | schemas['FileUpload']>({
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

  const onFileCreate = (tempId: string, response: schemas['FileUpload']) => {
    setFiles((prev) => {
      const updated = prev.filter((f) => f.id !== tempId)
      const newFile = buildFileObject(response)
      newFile.isUploading = true
      return [...updated, newFile as unknown as FileObject<T>]
    })
  }

  const onFileProcessing = (tempId: string, file: File) => {
    const processingFile = {
      ...buildFileObject({
        id: tempId,
        name: file.name,
        size: file.size,
        mime_type: file.type || 'application/octet-stream',
        is_uploaded: false,
      } as any),
      isProcessing: true,
    }
    setFiles((prev) => [...prev, processingFile])
  }

  const onFileUploaded = (response: FileRead) => {
    updateFile(response.id, (prev) => {
      return {
        ...prev,
        ...response,
        isProcessing: false,
        isUploading: false,
        uploadedBytes: response.size,
      }
    })
  }

  const onFileUploadProgress = (
    file: schemas['FileUpload'],
    uploaded: number,
  ) => {
    updateFile(file.id, (prev) => {
      return {
        ...prev,
        uploadedBytes: uploaded,
      }
    })
  }

  const onDrop = (acceptedFiles: File[], fileRejections: FileRejection[]) => {
    for (const file of acceptedFiles) {
      const upload = new Upload({
        service,
        organization,
        file,
        onFileProcessing,
        onFileCreate,
        onFileUploadProgress,
        onFileUploaded,
      })
      upload.run()
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
