import LogoType from '@/components/Brand/logos/LogoType'
import { UploadImage } from '@/components/Image/Image'
import AddOutlined from '@mui/icons-material/AddOutlined'
import { schemas } from '@polar-sh/client'

export default function SharedLayout({
  client,
  introduction,
  children,
}: {
  client?: schemas['AuthorizeResponseOrganization']['client']
  introduction?: string | React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="dark:bg-polar-950 flex flex-col items-center gap-12 bg-white pt-16 md:p-16">
      <div className="flex w-96 flex-col items-center gap-6">
        <div className="flex flex-row items-center gap-2">
          <LogoType className="h-10" />
          {client?.logo_uri && (
            <>
              <AddOutlined className="h-5" />
              <UploadImage
                src={client.logo_uri}
                approximateWidth={40}
                className="h-10"
                alt={client.client_name ?? client.client_id}
              />
            </>
          )}
        </div>
        {introduction && (
          <div className="dark:text-polar-400 w-full text-center text-lg text-gray-600">
            {introduction}
          </div>
        )}
      </div>
      {children && <div className="flex w-lg flex-col gap-6">{children}</div>}
    </div>
  )
}
