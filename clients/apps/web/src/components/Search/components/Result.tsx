import KeyboardReturnOutlined from '@mui/icons-material/KeyboardReturnOutlined'

interface Props {
  icon?: React.ReactNode
  title: string
  description?: string
}

export const Result = ({ icon, title, description }: Props) => {
  return (
    <div className="flex w-full flex-row items-center justify-between gap-3 px-2">
      <div className="flex w-full flex-col gap-0.5">
        <div className="flex flex-row items-center gap-2">
          {icon && (
            <span className="dark:text-polar-400 flex h-5 w-5 items-center justify-center text-gray-500">
              {icon}
            </span>
          )}
          <div className="font-medium text-gray-700 dark:text-white">
            {title}
          </div>
        </div>
        {description && (
          <div className="dark:text-polar-400 text-sm text-gray-500">
            {description}
          </div>
        )}
      </div>
      <div className="dark:bg-polar-700 -mr-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white px-1.5 py-0.5 opacity-0 group-data-[selected='true']:opacity-100">
        <KeyboardReturnOutlined
          className="dark:text-polar-500 text-gray-500"
          fontSize="inherit"
        />
      </div>
    </div>
  )
}
