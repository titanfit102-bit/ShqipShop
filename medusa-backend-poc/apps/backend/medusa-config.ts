import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// Self-hosted ShqipShop merchants get independent Redis services, not just
// different DB numbers on the same Redis server. These infrastructure modules
// are activated only when the operator supplies REDIS_URL.
// The CI proof sets SHQIPSHOP_REQUIRE_REDIS=true to fail closed.
const redisUrl = process.env.REDIS_URL
if (process.env.SHQIPSHOP_REQUIRE_REDIS === 'true' && !redisUrl) {
  throw new Error('ShqipShop Redis is required but REDIS_URL is missing')
}

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    // Medusa session store: without this it silently falls back to memory.
    redisUrl,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
  },
  modules: redisUrl ? [
    {
      resolve: '@medusajs/medusa/event-bus-redis',
      options: {
        redisUrl,
        jobOptions: {
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: { age: 3600, count: 1000 },
        },
      },
    },
    {
      resolve: '@medusajs/medusa/workflow-engine-redis',
      options: { redis: { redisUrl } },
    },
    {
      resolve: '@medusajs/medusa/locking',
      options: {
        providers: [
          {
            resolve: '@medusajs/medusa/locking-redis',
            id: 'locking-redis',
            is_default: true,
            options: { redisUrl },
          },
        ],
      },
    },
  ] : [],
})
