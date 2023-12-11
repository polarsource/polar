import { Article, ArticleUpdateVisibilityEnum } from '@polar-sh/sdk'
import { Label } from 'polarkit/components/ui/label'
import { RadioGroup, RadioGroupItem } from 'polarkit/components/ui/radio-group'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

interface VisibilityPickerProps {
  visibility: ArticleUpdateVisibilityEnum
  paidSubscribersOnly: boolean
  privateVisibilityAllowed: boolean
  linkVisibilityAllowed: boolean
  article: Article
  onChange: (visibility: ArticleUpdateVisibilityEnum) => void
}

export const VisibilityPicker = ({
  visibility,
  privateVisibilityAllowed,
  linkVisibilityAllowed,
  onChange,
}: VisibilityPickerProps) => {
  const handleVisibilityChange = useCallback(
    (visibility: string) => {
      onChange(visibility as ArticleUpdateVisibilityEnum)
    },
    [onChange],
  )

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-col gap-y-2">
        <span className="font-medium">Visibility</span>
        <p className="text-polar-500 dark:text-polar-500 text-sm">
          Determines the visibility of this post for eligible subscribers
        </p>
      </div>
      <RadioGroup value={visibility} onValueChange={handleVisibilityChange}>
        {Object.values(ArticleUpdateVisibilityEnum).map((v) => {
          const disabled =
            (v === ArticleUpdateVisibilityEnum.PRIVATE &&
              !privateVisibilityAllowed) ||
            (v === ArticleUpdateVisibilityEnum.HIDDEN && !linkVisibilityAllowed)

          return (
            <div key={v} className="flex items-center space-x-2">
              <RadioGroupItem value={v} id={v} disabled={disabled} />
              <Label
                className={twMerge(
                  'capitalize',
                  disabled
                    ? 'dark:text-polar-600 text-gray-300'
                    : 'dark:text-polar-50 text-gray-950',
                )}
                htmlFor={v}
              >
                {v}
              </Label>
            </div>
          )
        })}
      </RadioGroup>
    </div>
  )
}
