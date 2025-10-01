import AddPhotoAlternateOutlined from '@mui/icons-material/AddPhotoAlternateOutlined'
import { schemas } from '@polar-sh/client'
import { ReactElement, useCallback, useState } from 'react'
import { FileRejection } from 'react-dropzone'
import { twMerge } from 'tailwind-merge'
import { FileObject, useFileUpload } from '../../FileUpload'
import { FileList } from './FileList'

const DropzoneView = ({
  isDragActive,
  children,
}: {
  isDragActive: boolean
  children: ReactElement<any>
}) => {
  return (
    <>
      <div
        className={twMerge(
          'flex aspect-video w-full cursor-pointer items-center justify-center rounded-2xl border border-transparent px-4',
          isDragActive
            ? 'dark:border-polar-700 dark:bg-polar-950 border-blue-100 bg-blue-50'
            : 'dark:border-polar-700 bg-gray-100 dark:bg-transparent',
        )}
      >
        <div className="dark:text-polar-500 text-center text-gray-500">
          <div className="mb-4">
            <AddPhotoAlternateOutlined fontSize="medium" />
          </div>
          <p className="dark:text-polar-200 text-xs font-medium text-gray-700">
            {isDragActive ? "Drop it like it's hot" : 'Add product media'}
          </p>
          <p className="mt-2 text-xs">
            Up to 10MB each. 16:9 ratio recommended for optimal display.
          </p>
        </div>
        {children}
      </div>
    </>
  )
}

interface ProductMediasFieldProps {
  organization: schemas['Organization']
  value: schemas['ProductMediaFileRead'][] | undefined
  onChange: (value: schemas['ProductMediaFileRead'][]) => void
  compact?: boolean
}

const ProductMediasField = ({
  organization,
  value,
  onChange,
  compact,
}: ProductMediasFieldProps) => {
  const onFilesUpdated = useCallback(
    (files: FileObject<schemas['ProductMediaFileRead']>[]) => {
      onChange(files.filter((file) => file.is_uploaded).map((file) => file))
    },
    [onChange],
  )

  const [filesRejected, setFilesRejected] = useState<FileRejection[]>([])

  const {
    files,
    setFiles,
    removeFile,
    getRootProps,
    getInputProps,
    isDragActive,
  } = useFileUpload({
    organization: organization,
    service: 'product_media',
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/gif': [],
      'image/webp': [],
      'image/svg+xml': [],
    },
    maxSize: 10 * 1024 * 1024,
    onFilesUpdated,
    onFilesRejected: setFilesRejected,
    initialFiles: value || [],
  })
  return (
    <>
      <div
        className={twMerge(
          'grid gap-3 [&>div>*]:aspect-video',
          compact ? 'grid-cols-1' : 'grid-cols-2',
        )}
      >
        <FileList files={files} setFiles={setFiles} removeFile={removeFile} />
        <div {...getRootProps()}>
          <DropzoneView isDragActive={isDragActive}>
            <input {...getInputProps()} />
          </DropzoneView>
        </div>
      </div>
      {filesRejected.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-100 p-4 text-red-800 dark:border-red-800 dark:bg-red-900 dark:text-red-200">
          {filesRejected.map((file) => (
            <p key={file.file.name}>
              {file.file.name} is not a valid image or is too large.
            </p>
          ))}
        </div>
      )}
    </>
  )
}

export default ProductMediasField
