'use client'

import {
  BenefitDownloadablesCreate,
  FileServiceTypes,
  Organization,
} from '@polar-sh/sdk'

import { FileUploadOutlined as FileUploadIcon } from '@mui/icons-material'

import { useFiles } from '@/hooks/queries'
import { Switch } from 'polarkit/components/ui/atoms'
import { ReactElement } from 'react'
import { useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'

import { FileObject, useFileUpload } from '@/components/FileUpload'

const FilePreview = ({ file }: { file: FileObject }) => {
  return (
    <div className="h-14 w-14 rounded bg-gray-200 text-gray-600">
      <p className="font-semibold">.{file.extension}</p>
    </div>
  )
}

const FileUploadProgress = ({ file }: { file: FileObject }) => {
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

const FileUploadDetails = ({ file }: { file: FileObject }) => {
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
  file: FileObject
  updateFile: (callback: (prev: FileObject) => FileObject) => void
}) => {
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
  files: FileObject[]
  updateFile: (
    fileId: string,
    callback: (prev: FileObject) => FileObject,
  ) => void
}) => {
  const getUpdateScopedFile = (fileId: string) => {
    return (callback: (prev: FileObject) => FileObject) => {
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

const DownloadablesForm = ({
  organization,
  initialFiles,
}: {
  organization: Organization
  initialFiles: FileObject[]
}) => {
  const { setValue } = useFormContext<BenefitDownloadablesCreate>()

  /**
   * TODO
   *
   * Update design
   * Update benefit file properties to include enabled: true/false
   * Sortable files
   */

  const setFormFiles = (files: FileObject[]) => {
    const property = []
    for (const file of files) {
      if (file.isUploaded) {
        property.push(file.id)
      }
    }
    setValue('properties.files', property)
  }

  const {
    files,
    setFiles,
    updateFile,
    getRootProps,
    getInputProps,
    isDragActive,
  } = useFileUpload({
    organization: organization,
    service: FileServiceTypes.DOWNLOADABLE,
    onFilesUpdated: setFormFiles,
    initialFiles,
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

interface DownloadablesBenefitFormProps {
  organization: Organization
  update?: boolean
}

const DownloadablesEditForm = ({
  organization,
}: DownloadablesBenefitFormProps) => {
  const { getValues } = useFormContext<BenefitDownloadablesCreate>()

  const fileIds = getValues('properties.files')
  const filesQuery = useFiles(organization.id, fileIds)

  const files: FileRead[] = filesQuery.data?.items

  if (filesQuery.isLoading) {
    // TODO: Style me
    return <div>Loading...</div>
  }

  return <DownloadablesForm organization={organization} initialFiles={files} />
}

export const DownloadablesBenefitForm = ({
  organization,
  update = false,
}: DownloadablesBenefitFormProps) => {
  if (!update) {
    return <DownloadablesForm organization={organization} initialFiles={[]} />
  }

  return <DownloadablesEditForm organization={organization} />
}
