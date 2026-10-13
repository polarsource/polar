import { Flag } from 'effect/cli'
import type { CommentResult } from '@/services/pull-request-comment'
import * as ui from '@/utils/ui'

export const prComment = Flag.Boolean('pr-comment').pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    'Post the output as a comment on the pull request being built, using GITHUB_TOKEN',
  ),
)

export const commented = (result: CommentResult) =>
  result.action === 'skipped'
    ? ui.warning('Not building a pull request, skipped --pr-comment.')
    : ui.success(
        `${result.action === 'created' ? 'Commented on' : 'Updated the comment on'} pull request #${result.number}: ${result.url}`,
      )
