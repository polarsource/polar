import { schemas } from '@polar-sh/client'
import { StateCreator } from 'zustand'

interface FormDrafts {
  ProductCreate?: schemas['ProductCreate'] & {
    full_medias: schemas['ProductMediaFileRead'][]
  }
}

export interface FormDraftSlice {
  formDrafts: FormDrafts
  saveDraft: <K extends keyof FormDrafts>(key: K, data: FormDrafts[K]) => void
  clearDraft: (key: keyof FormDrafts) => void
}

export const createFormDraftSlice: StateCreator<
  FormDraftSlice,
  [],
  [],
  FormDraftSlice
> = (set) => ({
  formDrafts: {} as FormDrafts,
  saveDraft: (key, data) =>
    set((state) => ({
      formDrafts: { ...state.formDrafts, [key]: data },
    })),
  clearDraft: (key) =>
    set((state) => ({
      formDrafts: Object.keys(state.formDrafts)
        .filter((draftKey) => draftKey !== key)
        .reduce(
          (updatedFormDrafts, key) => ({
            ...updatedFormDrafts,
            // @ts-ignore
            [key]: state.formDrafts[key],
          }),
          {} as FormDrafts,
        ),
    })),
})
