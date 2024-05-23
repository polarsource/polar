'use client'

import {
  BenefitDownloadablesCreate,
  FileServiceTypes,
  Organization,
} from '@polar-sh/sdk'

import { FileUploadOutlined as FileUploadIcon } from '@mui/icons-material'

import { useFiles } from '@/hooks/queries'
import { ReactElement } from 'react'
import { useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'

import { FileObject, useFileUpload } from '@/components/FileUpload'
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
      if (file.is_uploaded) {
        property.push(file.id)
      }
    }
    setValue('properties.files', property)
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
      <FileList
        files={files}
        setFiles={setFiles}
        updateFile={updateFile}
        removeFile={removeFile}
      />
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

  const benefitId = getValues('id')
  const filesQuery = useFiles(organization.id, benefitId)

  const files: FileRead[] = filesQuery.data

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
