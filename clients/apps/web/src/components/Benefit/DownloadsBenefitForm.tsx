import { useAuth } from '@/hooks'
import { BenefitDownloadsCreate } from '@polar-sh/sdk'
import { useFormContext } from 'react-hook-form'

interface DownloadsBenefitFormProps {
  update?: boolean
}

export const DownloadsBenefitForm = ({
  update = false,
}: DownloadsBenefitFormProps) => {
  const {
    control,
    watch,
    formState: { defaultValues },
    setValue,
    setError,
    clearErrors,
  } = useFormContext<BenefitDownloadsCreate>()

  const description = watch('description')

  const { currentUser } = useAuth()

  return (
    <>
      <p>Downloads form</p>
    </>
  )
}
