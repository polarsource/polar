'use client'

import { FileObject, useFileUpload } from '@/components/FileUpload'
import { FileRead } from '@/components/FileUpload/Upload'
import { useFiles } from '@/hooks/queries'
import FileUploadIcon from '@mui/icons-material/FileUploadOutlined'
import { schemas } from '@polar-sh/client'
import { ReactElement, useEffect, useState } from 'react'
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

  const setFormFiles = (formFiles: FileObject[]) => {
    const files = []

    for (const file of formFiles) {
      if (file.is_uploaded) {
        files.push(file.id)
      }
    }

    if (files.length > 0) {
      clearErrors('properties.files')
    }

    setValue('properties.files', files)
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

  const {
    files,
    setFiles,
    updateFile,
    removeFile,
    getRootProps,
    getInputProps,
    isDragActive,
  } = useFileUpload({
    organization: organization,
    service: 'downloadable',
    onFilesUpdated: setFormFiles,
    initialFiles,
  })

  useEffect(() => {
    trigger('properties.files')
  }, [files, trigger])

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
    // TODO: Style me
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
