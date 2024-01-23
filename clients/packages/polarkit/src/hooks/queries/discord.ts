import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { api } from '../../api'
import { defaultRetry } from './retry'

export const useDiscordGuild: (
  guildToken?: string,
) => UseQueryResult<Record<string, any>, Error> = (guildToken?: string) =>
  useQuery({
    queryKey: ['discord', 'guild', guildToken],
    queryFn: () =>
      api.integrations.discordGuildLookup({
        guildToken: guildToken || '',
      }),

    retry: defaultRetry,
    enabled: !!guildToken,
  })
