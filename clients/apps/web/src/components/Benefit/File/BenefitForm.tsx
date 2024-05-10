'use client'

import { useAuth } from '@/hooks'
import { BenefitFileCreate, FileRead, Organization } from '@polar-sh/sdk'
import { useFormContext } from 'react-hook-form'

import Dropzone from './Dropzone'

interface FileBenefitFormProps {
  organization: Organization
  update?: boolean
}

export const FileBenefitForm = ({
  organization,
  update = false,
}: FileBenefitFormProps) => {
  const {
    control,
    watch,
    formState: { defaultValues },
    setValue,
    setError,
    clearErrors,
  } = useFormContext<BenefitFileCreate>()

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
