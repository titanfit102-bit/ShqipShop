import { authenticate, configureStoreSearch, defineMiddlewares } from '@medusajs/framework/http'
import { enforceStage12xCookieCsrfCi } from './middlewares/stage12x-cookie-csrf-ci'
import { ensureOrderReader } from './middlewares/ensure-order-reader'
import {verifyF08StrictRefundCi} from './middlewares/f08-refund-amount-ci'
import { enforceF08CiBearerPolicy, enforceF08CiProfilePolicy, enforceF08CiOwnerCartPolicy } from './middlewares/f08-revocation-ci'

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
  routes: [
    {
      // Stage 12X: two real built-in Medusa profile mutation paths, CI only.
      // This cannot be mistaken for global production CSRF protection.
      matcher: '/store/customers/me',
      method: ['POST', 'DELETE'],
      middlewares: [enforceStage12xCookieCsrfCi],
    },
    {
      matcher: '/admin/customers/:id',
      method: ['POST', 'DELETE'],
      middlewares: [enforceStage12xCookieCsrfCi],
    },
    {
      // Stage12AE: one additional built-in Admin product mutation, CI AOF only.
      // The handler itself independently checks the exact runner+Redis scope.
      // This is NOT global Medusa CSRF policy and does not change Production.
      matcher: '/admin/products/:id',
      method: ['POST'],
      middlewares: [enforceStage12xCookieCsrfCi],
    },
    {
      // Stage12AG: isolated Admin region-name POST CSRF regression only.
      // Same exact CI/AOF opt-in; never a Production-wide policy.
      matcher: '/admin/regions/:id',
      method: ['POST'],
      middlewares: [enforceStage12xCookieCsrfCi],
    },
    {
      // Exact fixture CI only. Outside CI this is a no-op, not a deployed fix.
      matcher: '/admin/payments/:id/refund',
      method: ['POST'],
      middlewares: [verifyF08StrictRefundCi],
    },
    {
      // Exact disposable CI-only owner guard: registered-account cart GET,
      // address updates, shipping-method selection, line-item mutations.
      // Non-CI traffic remains unaffected.
      matcher: '/store/carts/:id',
      method: ['GET', 'POST'],
      middlewares: [enforceF08CiOwnerCartPolicy],
    },
    {
      matcher: '/store/carts/:id/shipping-methods',
      method: ['POST'],
      middlewares: [enforceF08CiOwnerCartPolicy],
    },
    {
      // CI only: protect registered-cart association and validate guest claims.
      matcher: '/store/carts/:id/customer',
      method: ['POST'],
      middlewares: [enforceF08CiOwnerCartPolicy],
    },
    {
      matcher: '/store/carts/:id/line-items',
      method: ['POST'],
      middlewares: [enforceF08CiOwnerCartPolicy],
    },
    {
      matcher: '/store/carts/:id/line-items/:line_id',
      method: ['POST', 'DELETE'],
      middlewares: [enforceF08CiOwnerCartPolicy],
    },
    {
      // Exact-CI proof only: completion requires registered-cart ownership.
      matcher: '/store/carts/:id/complete',
      method: ['POST'],
      middlewares: [enforceF08CiOwnerCartPolicy],
    },
    {
      // CI-only demonstration of guard injection into a BUILT-IN Medusa
      // private customer profile endpoint. Outside exact disposable CI,
      // middleware is a no-op; real production auth behavior is unchanged.
      matcher: '/store/customers/me',
      method: ['GET'],
      middlewares: [enforceF08CiProfilePolicy],
    },
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
