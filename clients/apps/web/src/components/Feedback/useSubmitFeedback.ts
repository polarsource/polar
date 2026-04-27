import { api } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { useMutation } from '@tanstack/react-query'

export const useSubmitFeedback = () =>
  useMutation({
    mutationFn: (body: schemas['FeedbackCreate']) =>
      api.POST('/v1/feedbacks/', { body }),
  })
