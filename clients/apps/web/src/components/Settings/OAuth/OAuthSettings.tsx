'use client'

import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { useOAuth2Clients } from '@/hooks/queries/oauth'
import ArrowForward from '@mui/icons-material/ArrowForward'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import ShadowListGroup from '@polar-sh/ui/components/atoms/ShadowListGroup'
import { useState } from 'react'
import { EditOAuthClientModal } from './EditOAuthClientModal'
import { NewOAuthClientModal } from './NewOAuthClientModal'

const OAuthSettings = () => {
  const oauthClients = useOAuth2Clients()

  const {
    isShown: isNewOAuthClientModalShown,
    show: showNewOAuthClientModal,
    hide: hideNewOAuthClientModal,
  } = useModal()

  const {
    isShown: isEditOAuthClientModalShown,
    hide: hideEditOAuthClientModal,
    show: showEditOAuthClientModal,
  } = useModal()

  const [client, setClient] = useState<schemas['OAuth2Client'] | undefined>()

  const onCreate = (client: schemas['OAuth2Client']) => {
    hideNewOAuthClientModal()
    setClient(client)
    showEditOAuthClientModal()
  }

  const onOpen = (client: schemas['OAuth2Client']) => {
    setClient(client)
    showEditOAuthClientModal()
  }

  const onUpdate = () => {
    hideEditOAuthClientModal()
  }

  const onDelete = () => {
    hideEditOAuthClientModal()
  }

  return (
    <ShadowListGroup>
      {oauthClients.data?.items && oauthClients.data.items.length > 0 ? (
        oauthClients.data?.items.map((client) => {
          return (
            <ShadowListGroup.Item key={client.client_id}>
              <OAuthClientDetails client={client} onClick={onOpen} />
            </ShadowListGroup.Item>
          )
        })
      ) : (
        <ShadowListGroup.Item>
          <p className="dark:text-polar-400 text-sm text-gray-500">
            You don&apos;t have any configured OAuth Applications
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
          <NewOAuthClientModal
            onSuccess={onCreate}
            onHide={hideNewOAuthClientModal}
          />
        }
      />
      <InlineModal
        isShown={isEditOAuthClientModalShown}
        hide={hideEditOAuthClientModal}
        modalContent={
          client ? (
            <EditOAuthClientModal
              client={client}
              onSuccess={onUpdate}
              onDelete={onDelete}
              onHide={hideEditOAuthClientModal}
            />
          ) : (
            <></>
          )
        }
      />
    </ShadowListGroup>
  )
}

interface OAuthClientDetailsProps {
  client: schemas['OAuth2Client']
  onClick: (client: schemas['OAuth2Client']) => void
}

const OAuthClientDetails = ({ client, onClick }: OAuthClientDetailsProps) => {
  return (
    <div
      className="flex w-full cursor-pointer flex-col gap-y-4"
      onClick={() => onClick(client)}
    >
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center gap-x-4">
          <Avatar
            className="h-12 w-12"
            avatar_url={client.logo_uri || null}
            name={client.client_name}
          />
          <div className="flex flex-col">
            <h3 className="text-md mr-4 text-ellipsis whitespace-nowrap">
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
        <Button variant="secondary">
          <ArrowForward fontSize="inherit" />
        </Button>
      </div>
    </div>
  )
}

export default OAuthSettings
