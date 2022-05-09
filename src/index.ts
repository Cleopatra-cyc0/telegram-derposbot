import "dotenv/config"
import { Context, Telegraf } from "telegraf"
import logger, { track } from "./log"
import { Settings } from "luxon"
import { EntityManager } from "@mikro-orm/core"
import { PostgreSqlDriver } from "@mikro-orm/postgresql"
import localtunnel from "localtunnel"
import Koa from "koa"
import bodyParser from "koa-bodyparser"
import Router from "@koa/router"
import MikroOrm from "./database"
import ChatSubscription, { SubScriptionType } from "./entities/ChatSubscription"
import subscriptionCommands from "./commands/subscription"
import birthdayCommands from "./commands/birthday"
import triviaCommands from "./commands/trivia"
import shitCommands from "./commands/shit"
import { connectCommands } from "./commands/connect"
Settings.defaultZone = process.env.TIMEZONE ?? "utc"

const telegramToken = process.env.TG_TOKEN

if (!telegramToken) {
  logger.fatal("No telegram token provided, exiting")
  process.exit(1)
}

export interface MyContext extends Context {
  db: EntityManager<PostgreSqlDriver>
}

// Create bot
const bot = new Telegraf<MyContext>(telegramToken)

bot.on("message", async (ctx, next) => {
  const time = track()

  await next()

  logger.trace(
    {
      message: ctx.message,
      ...time(),
    },
    "message",
  )
})

bot.use(async (ctx, next) => {
  ctx.db = (await MikroOrm).em.fork()
  await next()
  ctx.db.flush()
})

const stopCronJob = birthdayCommands(bot)
triviaCommands(bot)
subscriptionCommands(bot)
shitCommands(bot)
connectCommands(bot)
;(async () => {
  let domain
  if (process.env.WEBHOOK_DOMAIN != null && process.env.WEBHOOK_DOMAIN != "") {
    domain = process.env.WEBHOOK_DOMAIN
  } else if (process.env.DEV_PORT != null && process.env.DEV_PORT != "") {
    domain = (await localtunnel({ port: parseInt(process.env.DEV_PORT) })).url
    logger.info({ domain }, "using localtunnel")
  }

  const secretPath = `/telegraf/${bot.secretPathComponent()}`

  await bot.telegram.setWebhook(`${domain}${secretPath}`)

  const app = new Koa()
  app.use(bodyParser())
  const router = new Router()
  router.post(secretPath, async ctx => {
    try {
      await bot.handleUpdate(ctx.request.body)
    } catch (error) {
      logger.fatal({ error }, "bot.handleUpdate error")
    }
    ctx.status = 200
  })

  app.use(router.middleware())
  app.listen(process.env.DEV_PORT ?? 80)

  logger.trace("launch")
  const subs = await (await MikroOrm).em.fork().find(ChatSubscription, { type: SubScriptionType.Status })
  try {
    const msgs = await Promise.all(subs.map(s => bot.telegram.sendMessage(s.telegramChatId, "Ben er weer")))
    logger.trace({ chats: msgs.map(m => m.chat.id) }, "sent startup message")
  } catch (error) {
    logger.error({ error }, "failed sending start status")
  }
})()

const gracefulStop = async (reason: string) => {
  logger.info("Stopping due to kernel signal")
  bot.stop(reason)
  stopCronJob()
  await (await MikroOrm).close(true)
  process.exit(0)
}

// Enable gracefull bot stopping with ctrl-c
process.once("SIGTERM", () => gracefulStop("SIGTERM"))
process.once("SIGINT", () => gracefulStop("SIGINT"))
