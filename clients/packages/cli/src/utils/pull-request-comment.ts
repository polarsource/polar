import { Flag } from 'effect/cli'
import type { CommentResult } from '@/services/pull-request-comment'
import * as ui from '@/utils/ui'

export const prComment = Flag.Boolean('pr-comment').pipe(
  Flag.withDefault(false),
  Flag.withDescription(
    'Post the output as a comment on the pull request being built, using GITHUB_TOKEN',
  ),
)

export const commented = (result: CommentResult) => {
  switch (result.action) {
    case 'skipped':
      return ui.warning('Not building a pull request, skipped --pr-comment.')
    case 'unneeded':
      return ui.success(
        `Nothing changes, so no comment on pull request #${result.number}`,
      )
    case 'deleted':
      return ui.success(
        `Nothing changes anymore, removed the comment on pull request #${result.number}`,
      )
    case 'created':
      return ui.success(
        `Commented on pull request #${result.number}: ${result.url}`,
      )
    case 'updated':
      return ui.success(
        `Updated the comment on pull request #${result.number}: ${result.url}`,
      )
  }
}
