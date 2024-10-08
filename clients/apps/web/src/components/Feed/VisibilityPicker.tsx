import { Article, ArticleVisibility } from '@polar-sh/sdk'
import { Label } from 'polarkit/components/ui/label'
import { RadioGroup, RadioGroupItem } from 'polarkit/components/ui/radio-group'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

interface VisibilityPickerProps {
  visibility: ArticleVisibility
  paidSubscribersOnly: boolean
  privateVisibilityAllowed: boolean
  linkVisibilityAllowed: boolean
  article: Article
  onChange: (visibility: ArticleVisibility) => void
}

export const VisibilityPicker = ({
  visibility,
  privateVisibilityAllowed,
  linkVisibilityAllowed,
  onChange,
}: VisibilityPickerProps) => {
  const handleVisibilityChange = useCallback(
    (visibility: string) => {
      onChange(visibility as ArticleVisibility)
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
        {Object.values(ArticleVisibility).map((v) => {
          const disabled =
            (v === ArticleVisibility.PRIVATE && !privateVisibilityAllowed) ||
            (v === ArticleVisibility.HIDDEN && !linkVisibilityAllowed)

          return (
            <div key={v} className="flex items-center space-x-2">
              <RadioGroupItem value={v} id={v} disabled={disabled} />
              <Label
                className={twMerge(
                  'capitalize',
                  disabled
                    ? 'dark:text-polar-600 text-gray-500'
                    : 'text-gray-950 dark:text-white',
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
