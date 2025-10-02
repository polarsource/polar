'use client'

import { FileObject, useFileUpload } from '@/components/FileUpload'
import { FileRead } from '@/components/FileUpload/Upload'
import { useFiles } from '@/hooks/queries'
import FileUploadIcon from '@mui/icons-material/FileUploadOutlined'
import { schemas } from '@polar-sh/client'
import { ReactElement, useEffect, useState } from 'react'
import { FileRejection } from 'react-dropzone'
import { useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { FileList } from './FileList'

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
          'dark:border-polar-700 flex w-full cursor-pointer items-center justify-center rounded-2xl border border-gray-200 pb-8 pt-8 text-black dark:text-white',
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
    </>
  )
}

const DownloadablesForm = ({
  organization,
  initialFiles,
  initialArchivedFiles,
}: {
  organization: schemas['Organization']
  initialFiles: FileRead[]
  initialArchivedFiles: { [key: string]: boolean }
}) => {
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
  const [uploadErrors, setUploadErrors] = useState<{ [key: string]: string }>(
    {},
  )
  const [formFiles, setFormFilesState] = useState<FileObject[]>(
    initialFiles.map((file) => ({
      ...file,
      isUploading: false,
      uploadedBytes: file.is_uploaded ? file.size : 0,
    })),
  )

  const updateFormState = () => {
    const files = formFiles
      .filter((file) => file.is_uploaded)
      .map((file) => file.id)
    setValue('properties.files', files, { shouldValidate: false })
    if (files.length > 0) {
      clearErrors('properties.files')
    }
  }

  const updateFormFiles = (updatedFiles: FileObject[]) => {
    setFormFilesState(updatedFiles)
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

  useEffect(() => {
    updateFormState()
  }, [formFiles])

  const {
    files,
    setFiles,
    updateFile,
    removeFile,
    getRootProps,
    getInputProps,
    isDragActive,
    isProcessing,
    lastError,
    totalUploadingFiles,
  } = useFileUpload({
    organization: organization,
    service: 'downloadable',
    maxSize: 10 * 1024 * 1024 * 1024, // 10GB limit for downloadable files
    onFilesUpdated: updateFormFiles,
    initialFiles,
    onFilesRejected: (rejections: FileRejection[]) => {
      const errors = rejections.reduce(
        (acc, rej) => {
          acc[rej.file.name] = rej.errors.map((e) => e.message).join(', ')
          return acc
        },
        {} as { [key: string]: string },
      )
      setUploadErrors((prev) => ({ ...prev, ...errors }))
    },
  })

  useEffect(() => {
    trigger('properties.files')
  }, [files, trigger])

  const uploadingCount =
    files.filter((f) => f.isUploading).length +
    files.filter((f) => f.is_uploaded).length
  const fileWord = uploadingCount === 1 ? 'file' : 'files'

  return (
    <>
      <div {...getRootProps()}>
        <DropzoneView isDragActive={isDragActive}>
          <input {...getInputProps()} />
        </DropzoneView>
      </div>
      {isProcessing && (
        <div
          className="mt-2 text-sm text-blue-600 dark:text-blue-400"
          aria-live="polite"
        >
          Uploading {uploadingCount} of {totalUploadingFiles} {fileWord}...
          please keep this tab open
        </div>
      )}
      {lastError && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {lastError}
        </p>
      )}
      {Object.keys(uploadErrors).length > 0 && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
          <p>Upload errors:</p>
          <ul className="list-disc pl-5">
            {Object.entries(uploadErrors).map(([fileName, error]) => (
              <li key={fileName}>
                {fileName}: {error}
              </li>
            ))}
          </ul>
        </div>
      )}
      <FileList
        files={files}
        setFiles={setFiles}
        updateFile={updateFile}
        removeFile={removeFile}
        archivedFiles={archivedFiles}
        setArchivedFile={setArchivedFile}
      />
      {errors.properties?.files && (
        <p className="text-destructive-foreground text-sm">
          {errors.properties.files.message}
        </p>
      )}
    </>
  )
}

interface DownloadablesBenefitFormProps {
  organization: schemas['Organization']
  update?: boolean
}

const DownloadablesEditForm = ({
  organization,
}: DownloadablesBenefitFormProps) => {
  const { getValues } = useFormContext<schemas['BenefitDownloadablesCreate']>()

  const fileIds = getValues('properties.files')
  const archivedFiles = getValues('properties.archived') ?? {}
  const filesQuery = useFiles(organization.id, fileIds)

  const files =
    filesQuery?.data?.items.filter((v): v is FileRead => Boolean(v)) ?? []

  if (filesQuery.isLoading) {
    return <div>Loading...</div>
  }

  return (
    <DownloadablesForm
      organization={organization}
      initialFiles={files}
      initialArchivedFiles={archivedFiles}
    />
  )
}

export const DownloadablesBenefitForm = ({
  organization,
  update = false,
}: DownloadablesBenefitFormProps) => {
  if (!update) {
    return (
      <DownloadablesForm
        organization={organization}
        initialFiles={[]}
        initialArchivedFiles={{}}
      />
    )
  }

  return <DownloadablesEditForm organization={organization} />
}
