import { authenticate, configureStoreSearch, defineMiddlewares } from '@medusajs/framework/http'
import { ensureOrderReader } from './middlewares/ensure-order-reader'
import { enforceF08CiBearerPolicy } from './middlewares/f08-revocation-ci'

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
  routes: [
    {
      // CI-only, disposable PostgreSQL quote review/accept. Invalid Medusa
      // bearer credentials must not silently fall back to guest capability.
      matcher: '/store/shqipshop/quote-review-accept-ci',
      method: ['GET', 'POST'],
      middlewares: [
        authenticate('customer', ['session', 'bearer'], { allowUnauthenticated: true }),
        enforceF08CiBearerPolicy,
      ],
    },
    {
      // This endpoint's handler is hard-disabled except disposable localhost CI.
      // Still attach Medusa's real session/JWT authentication middleware;
      // invalid auth must never be silently treated as guest credentials.
      matcher: '/store/shqipshop/quote-boundary-ci',
      method: ['POST'],
      middlewares: [
        authenticate('customer', ['session', 'bearer'], { allowUnauthenticated: true }),
        enforceF08CiBearerPolicy,
      ],
    },
    {
      // Disposable per-JWT deny-list demonstration, not global logout.
      matcher: '/store/shqipshop/f08-token-revoke-ci',
      method: ['POST'],
      middlewares: [authenticate('customer', ['bearer'])],
    },
    {
      matcher: '/store/orders/:id',
      method: ['GET'],
      middlewares: [
        authenticate('customer', ['session', 'bearer'], { allowUnauthenticated: true }),
        ensureOrderReader,
      ],
    },
    {
      method: ['POST'],
      matcher: '/store/search',
      middlewares: [
        configureStoreSearch({
          allowed_indexes: {
            product: true,
          },
        }),
      ],
    },
  ],
})
