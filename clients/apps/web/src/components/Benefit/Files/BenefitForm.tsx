'use client'

import { useAuth } from '@/hooks'
import { BenefitFilesCreate } from '@polar-sh/sdk'
import { useFormContext } from 'react-hook-form'

import Dropzone from './Dropzone'

interface FilesBenefitFormProps {
  update?: boolean
}

export const FilesBenefitForm = ({ update = false }: FilesBenefitFormProps) => {
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

  return (
    <>
      <p>Downloads form</p>
      <Dropzone onUploaded={() => console.log('uploaded')} />
    </>
  )
}
