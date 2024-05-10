'use client'

import { useAuth } from '@/hooks'
import { BenefitFilesCreate, FileRead, Organization } from '@polar-sh/sdk'
import { useFormContext } from 'react-hook-form'

import Dropzone from './Dropzone'

interface FilesBenefitFormProps {
  organization: Organization
  update?: boolean
}

export const FilesBenefitForm = ({
  organization,
  update = false,
}: FilesBenefitFormProps) => {
  const {
    control,
    watch,
    formState: { defaultValues },
    setValue,
    setError,
    clearErrors,
  } = useFormContext<BenefitFilesCreate>()

  const description = watch('description')

  const { currentUser } = useAuth()

  const onUploaded = (file: FileRead) => {
    const fileId = file.id
    setValue('properties.files', [fileId])
  }

  return (
    <>
      <p>Downloads form</p>
      <Dropzone onUploaded={onUploaded} organization={organization} />
    </>
  )
}
