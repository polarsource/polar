import { api } from '@/utils/api'
import { DiscordGuild } from '@polar-sh/api'
import { UseQueryResult, useQuery } from '@tanstack/react-query'
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
