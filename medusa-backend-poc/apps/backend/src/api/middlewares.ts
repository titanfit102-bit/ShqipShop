import { authenticate, configureStoreSearch, defineMiddlewares } from '@medusajs/framework/http'
import { ensureOrderReader } from './middlewares/ensure-order-reader'

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
  routes: [
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
