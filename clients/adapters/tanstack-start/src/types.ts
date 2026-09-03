import type { RouteMethodHandlerCtx } from '@tanstack/react-start'

type StartRouteHandlerContext<TPath extends string> = Pick<
  RouteMethodHandlerCtx<unknown, never, TPath, unknown, unknown, unknown>,
  'request'
>

export type StartRouteHandler<TPath extends string> = (
  context: StartRouteHandlerContext<TPath>,
) => Promise<Response>
