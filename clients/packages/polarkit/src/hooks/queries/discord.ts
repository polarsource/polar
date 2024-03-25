import { DiscordGuild } from '@polar-sh/sdk'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { defaultRetry } from './retry'

export const useDiscordGuild: (
  guildToken?: string,
) => UseQueryResult<DiscordGuild, Error> = (guildToken?: string) =>
  useQuery({
    queryKey: ['discord', 'guild', guildToken],
    queryFn: () =>
      api.integrationsDiscord.discordGuildLookup({
        guildToken: guildToken || '',
      }),

    retry: defaultRetry,
    enabled: !!guildToken,
  })
