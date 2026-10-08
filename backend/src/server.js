import mongoose from 'mongoose'
import { createServer } from 'node:http'
import { createApp } from './app.js'
import { getConfig } from './config/env.js'
import { createChatSocketServer } from './chatSocket.js'
import { startSlaNotificationScheduler } from './services/slaNotificationScheduler.js'

async function start() {
  const config = getConfig()
  try {
    await mongoose.connect(config.mongoUri)
  } catch {
    throw new Error('Could not connect to MongoDB. Verify MONGO_URI and ensure the database is reachable.')
  }
  const app = createApp(config)
  const server = createServer(app)
  const io = createChatSocketServer(server, config)
  app.set('io', io)
  startSlaNotificationScheduler({ io })
  server.listen(config.port, () => {
    console.info(`NEXA API listening on port ${config.port}`)
  })
}

start().catch((error) => {
  console.error(`NEXA API could not start: ${error.message}`)
  process.exitCode = 1
})
