'use client'

import { AnimatedIconButton } from '@/components/Feed/Posts/Post'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { useOAuth2Clients } from '@/hooks/queries/oauth'
import { ArrowForward } from '@mui/icons-material'
import { OAuth2Client } from '@polar-sh/sdk'
import {
  FormattedDateTime,
  ShadowListGroup,
} from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import { useRef, useState } from 'react'
import { useHoverDirty } from 'react-use'
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

  const [client, setClient] = useState<OAuth2Client | undefined>()

  const onCreate = (client: OAuth2Client) => {
    hideNewOAuthClientModal()
    setClient(client)
    showEditOAuthClientModal()
  }

  const onOpen = (client: OAuth2Client) => {
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
        oauthClients.data?.items?.map((client) => {
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
  client: OAuth2Client
  onClick: (client: OAuth2Client) => void
}

const OAuthClientDetails = ({ client, onClick }: OAuthClientDetailsProps) => {
  const ref = useRef<HTMLDivElement>(null)
  const isHovered = useHoverDirty(ref)

  return (
    <div
      ref={ref}
      className="flex w-full cursor-pointer flex-col gap-y-4"
      onClick={() => onClick(client)}
    >
      <div className="flex flex-row items-center justify-between ">
        <div className="flex flex-row items-center gap-x-4">
          <Avatar
            className="h-12 w-12"
            avatar_url={client.logo_uri}
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
        <AnimatedIconButton active={isHovered} variant="secondary">
          <ArrowForward fontSize="inherit" />
        </AnimatedIconButton>
      </div>
    </div>
  )
}

export default OAuthSettings
