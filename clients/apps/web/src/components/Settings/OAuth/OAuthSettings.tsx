import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { useOAuth2Clients } from '@/hooks/queries/oauth'
import { OAuth2Client } from '@polar-sh/sdk'
import {
  FormattedDateTime,
  ShadowListGroup,
} from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import { NewOAuthClientModal } from './NewOAuthClientModal'

export const OAuthSettings = () => {
  const oauthClients = useOAuth2Clients()

  const {
    isShown: isNewOAuthClientModalShown,
    show: showNewOAuthClientModal,
    hide: hideNewOAuthClientModal,
  } = useModal()

  return (
    <ShadowListGroup>
      {oauthClients.data?.items && oauthClients.data.items.length > 0 ? (
        oauthClients.data?.items?.map((client) => {
          return (
            <ShadowListGroup.Item key={client.client_id}>
              <OAuthClientDetails client={client} />
            </ShadowListGroup.Item>
          )
        })
      ) : (
        <ShadowListGroup.Item>
          <p className="dark:text-polar-400 text-sm text-gray-500">
            You don&apos;t have any configured OAuth Apps
          </p>
        </ShadowListGroup.Item>
      )}
      <ShadowListGroup.Item>
        <div className="flex flex-row items-center gap-x-4">
          <Button asChild onClick={showNewOAuthClientModal}>
            New OAuth App
          </Button>
        </div>
      </ShadowListGroup.Item>
      <InlineModal
        isShown={isNewOAuthClientModalShown}
        hide={hideNewOAuthClientModal}
        modalContent={
          <NewOAuthClientModal hideModal={hideNewOAuthClientModal} />
        }
      />
    </ShadowListGroup>
  )
}

interface OAuthClientDetailsProps {
  client: OAuth2Client
}

const OAuthClientDetails = ({ client }: OAuthClientDetailsProps) => {
  return (
    <div className="flex w-full flex-col gap-y-4">
      <div className="flex flex-row items-center justify-between ">
        <div className="flex  flex-row overflow-hidden">
          <div className="flex flex-col gap-y-1 overflow-hidden">
            <h3 className="text-md mr-4 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-sm">
              {client.client_name}
            </h3>
            <p className="dark:text-polar-400 text-sm text-gray-500">
              <FormattedDateTime
                datetime={client.created_at}
                dateStyle="long"
              />
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
