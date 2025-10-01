'use client'

import { schemas } from '@polar-sh/client'
import { useState } from 'react'
import { Accept, FileRejection, useDropzone } from 'react-dropzone'
import { FileRead, Upload } from './Upload'

export type FileObject<
  T extends FileRead | schemas['FileUpload'] = FileRead | schemas['FileUpload'],
> = T & {
  isUploading: boolean
  uploadedBytes: number
}

const buildFileObject = <T extends FileRead | schemas['FileUpload']>(
  file: T,
): FileObject<T> => {
  return {
    ...file,
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

  const [isProcessing, setIsProcessing] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [totalUploadingFiles, setTotalUploadingFiles] = useState(0)

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

  const onFileCreate = (response: schemas['FileUpload']) => {
    const newFile = buildFileObject(response)
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

  const onDrop = async (
    acceptedFiles: File[],
    fileRejections: FileRejection[],
  ) => {
    if (acceptedFiles.length === 0 && fileRejections.length > 0) {
      setLastError('Some files were rejected. See console for details.')
      if (onFilesRejected) {
        onFilesRejected(fileRejections)
      }
      return
    }

    setIsProcessing(true)
    setLastError(null)
    setTotalUploadingFiles(acceptedFiles.length)

    const uploadPromises = acceptedFiles.map(async (file) => {
      const upload = new Upload({
        service,
        organization,
        file,
        onFileCreate,
        onFileUploadProgress,
        onFileUploaded,
        onError: (msg, error) => {
          console.error(`Upload failed for ${file.name}: ${msg}`, error)
          return false
        },
      })
      return { file, result: await upload.run() }
    })

    const results = await Promise.allSettled(uploadPromises)
    const errors = results
      .filter((result) => result.status === 'rejected' || !result.value.result)
      .map((result) => {
        if (result.status === 'rejected') {
          return {
            fileName: (result as any).value?.file?.name || 'Unknown file',
            error: (result as PromiseRejectedResult).reason.toString(),
          }
        }
        return {
          fileName: result.value.file.name,
          error: 'Upload failed',
        }
      })

    if (errors.length > 0) {
      setLastError(
        `Failed to upload ${errors.length} file(s). See details below.`,
      )
    }

    if (fileRejections.length > 0) {
      setLastError((prev) =>
        prev
          ? `${prev} Some files were rejected.`
          : 'Some files were rejected. See console for details.',
      )
      if (onFilesRejected) {
        onFilesRejected(fileRejections)
      }
    }

    setIsProcessing(false)
    setTotalUploadingFiles(0)
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
    isProcessing,
    lastError,
    totalUploadingFiles,
    ...dropzone,
  }
}
