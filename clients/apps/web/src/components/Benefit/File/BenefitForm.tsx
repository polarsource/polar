'use client'

import { useAuth } from '@/hooks'
import { BenefitFileCreate } from '@polar-sh/sdk'
import { useFormContext } from 'react-hook-form'

import Dropzone from './Dropzone'

interface FileBenefitFormProps {
  update?: boolean
}

export const FileBenefitForm = ({ update = false }: FileBenefitFormProps) => {
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

  return (
    <>
      <p>Downloads form</p>
      <Dropzone onUploaded={() => console.log('uploaded')} />
    </>
  )
}
