import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { useOAuth2Clients } from '@/hooks/queries/oauth'
import { OAuth2ClientConfiguration } from '@polar-sh/sdk'
import { ShadowListGroup } from 'polarkit/components/ui/atoms'
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
            <ShadowListGroup.Item key={client.id}>
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
  client: OAuth2ClientConfiguration
}

const OAuthClientDetails = ({ client }: OAuthClientDetailsProps) => {
  return <div></div>
}
