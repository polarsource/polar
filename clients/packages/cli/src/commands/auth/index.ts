import { Command } from 'effect/unstable/cli'
import { list } from '@/commands/auth/list'
import { login } from '@/commands/auth/login'
import { logout } from '@/commands/auth/logout'
import { org } from '@/commands/auth/org'
import { whoami } from '@/commands/auth/whoami'

export const auth = Command.make('auth').pipe(
  Command.withDescription('Manage your Polar sessions and active organization'),
  Command.withSubcommands([login, whoami, list, org, logout]),
)
