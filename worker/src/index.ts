import { createApp } from './app'
import { startPipelineWorker } from './pipeline/runner'
import { env } from './lib/env'
import { logger } from './lib/logger'

const app = createApp()

startPipelineWorker()

logger.info({ port: env.PORT }, 'server starting')

export default {
  port: env.PORT,
  fetch: app.fetch,
}
