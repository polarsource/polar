'use client'

import { FileObject, useFileUpload } from '@/components/FileUpload'
import { FileRead } from '@/components/FileUpload/Upload'
import { toast } from '@/components/Toast/use-toast'
import { useFiles } from '@/hooks/queries/files'
import FileUploadIcon from '@mui/icons-material/FileUploadOutlined'
import { schemas } from '@polar-sh/client'
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { FileList } from './FileList'

const DropzoneView = ({
  isDragActive,
  children,
}: {
  isDragActive: boolean
  children: ReactElement<any>
}) => {
  return (
    <div
      className={twMerge(
        'dark:border-polar-700 flex w-full cursor-pointer items-center justify-center rounded-2xl border border-gray-200 pt-8 pb-8 text-black dark:text-white',
        isDragActive
          ? 'border-blue-100 bg-blue-50 dark:border-blue-900 dark:bg-blue-950'
          : 'dark:bg-polar-800 bg-gray-100',
      )}
    >
      <div className="flex flex-col items-center gap-y-4 text-center">
        <div className={isDragActive ? 'text-blue-500' : ''}>
          <FileUploadIcon fontSize="large" />
        </div>
        <h3 className="font-medium">
          {!isDragActive && 'Feed me some bytes'}
          {isDragActive && "Drop it like it's hot"}
        </h3>
        <p className="text-sm">
          You can drop files here or{' '}
          <a className="text-blue-500">click like a Netscape user</a>
        </p>
      </div>
      {children}
    </div>
  )
}

interface DownloadablesFormProps {
  organization: schemas['Organization']
  initialFiles: FileRead[]
  initialArchivedFiles: { [key: string]: boolean }
  onUploadingChange?: (uploading: boolean) => void
}

const DownloadablesForm = ({
  organization,
  initialFiles,
  initialArchivedFiles,
  onUploadingChange,
}: DownloadablesFormProps) => {
  const {
    setValue,
    register,
    clearErrors,
    formState: { errors },
    trigger,
  } = useFormContext<schemas['BenefitDownloadablesCreate']>()

  register('properties.files', {
    minLength: 1,
    required: 'Please upload at least one file',
    validate: {
      notUploading: () =>
        files.filter((file) => !file.is_uploaded).length === 0 ||
        'Please wait for all files to finish uploading',
    },
  })

  const [archivedFiles, setArchivedFiles] = useState<{
    [key: string]: boolean
  }>(initialArchivedFiles ?? {})

  // Sync files to form state via effect to avoid setState during render
  const pendingFileIds = useRef<string[] | null>(null)
  const [syncTrigger, setSyncTrigger] = useState(0)

  useEffect(() => {
    if (pendingFileIds.current === null) return
    if (pendingFileIds.current.length > 0) {
      clearErrors('properties.files')
    }
    setValue('properties.files', pendingFileIds.current)
    pendingFileIds.current = null
  }, [syncTrigger, clearErrors, setValue])

  const onFilesUpdated = (updatedFiles: FileObject[]) => {
    pendingFileIds.current = updatedFiles
      .filter((f) => f.is_uploaded)
      .map((f) => f.id)
    setSyncTrigger((n) => n + 1)
  }

  const setArchivedFile = (fileId: string, archived: boolean) => {
    setArchivedFiles((prev) => {
      const updated = { ...prev, [fileId]: archived }
      if (!archived) {
        delete updated[fileId]
      }
      setValue('properties.archived', updated)
      return updated
    })
  }

  const onFileUploadError = useCallback((fileName: string) => {
    toast({
      title: 'Upload Failed',
      description: `Failed to upload ${fileName}. Please try again.`,
    })
  }, [])

  const {
    files,
    setFiles,
    updateFile,
    removeFile,
    getRootProps,
    getInputProps,
    isDragActive,
  } = useFileUpload({
    organization,
    service: 'downloadable',
    onFilesUpdated,
    onFileUploadError,
    initialFiles,
  })

  const isUploading = files.some((file) => !file.is_uploaded)

  useEffect(() => {
    onUploadingChange?.(isUploading)
  }, [isUploading, onUploadingChange])

  useEffect(() => {
    // Only re-validate when uploads complete, not during upload progress
    // This prevents the error message from bouncing in/out while uploading
    if (!isUploading) {
      trigger('properties.files')
    }
  }, [isUploading, trigger])

  return (
    <>
      <div {...getRootProps()}>
        <DropzoneView isDragActive={isDragActive}>
          <input {...getInputProps()} />
        </DropzoneView>
      </div>
      <FileList
        files={files}
        setFiles={setFiles}
        updateFile={updateFile}
        removeFile={removeFile}
        archivedFiles={archivedFiles}
        setArchivedFile={setArchivedFile}
      />
      <p className="text-destructive-foreground min-h-[20px] text-sm">
        {errors.properties?.files?.message}
      </p>
    </>
  )
}

interface DownloadablesBenefitFormProps {
  organization: schemas['Organization']
  update?: boolean
  onUploadingChange?: (uploading: boolean) => void
}

export const DownloadablesBenefitForm = ({
  organization,
  update = false,
  onUploadingChange,
}: DownloadablesBenefitFormProps) => {
  useFormContext<schemas['BenefitDownloadablesCreate']>()

  if (!update) {
    return (
      <DownloadablesForm
        organization={organization}
        initialFiles={[]}
        initialArchivedFiles={{}}
        onUploadingChange={onUploadingChange}
      />
    )
  }

  return (
    <DownloadablesEditForm
      organization={organization}
      onUploadingChange={onUploadingChange}
    />
  )
}

const DownloadablesEditForm = ({
  organization,
  onUploadingChange,
}: {
  organization: schemas['Organization']
  onUploadingChange?: (uploading: boolean) => void
}) => {
  const { getValues } = useFormContext<schemas['BenefitDownloadablesCreate']>()

  // Capture initial values once on mount to keep query key stable during uploads
  const [initial] = useState(() => ({
    fileIds: getValues('properties.files'),
    archivedFiles: getValues('properties.archived') ?? {},
  }))

  const filesQuery = useFiles(organization.id, initial.fileIds)

  if (filesQuery.isLoading) {
    return <div>Loading...</div>
  }

  return (
    <DownloadablesForm
      organization={organization}
      initialFiles={filesQuery.data?.items ?? []}
      initialArchivedFiles={initial.archivedFiles}
      onUploadingChange={onUploadingChange}
    />
  )
}
