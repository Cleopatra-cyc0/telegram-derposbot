import "dotenv/config"
import { Context as TelegrafContext, Telegraf } from "telegraf"
import logger, { track } from "./log"
import { Settings } from "luxon"
import { EntityManager } from "@mikro-orm/core"
import { PostgreSqlDriver } from "@mikro-orm/postgresql"
import localtunnel from "localtunnel"
import Koa, { Context as KoaContext } from "koa"
import bodyParser from "koa-bodyparser"
import Router from "@koa/router"
import { Server } from "http"
import MikroOrm from "./database"
import ChatSubscription, { SubScriptionType } from "./entities/ChatSubscription"
import subscriptionCommands from "./commands/subscription"
import birthdayCommands from "./commands/birthday"
import triviaCommands from "./commands/trivia"
import shitCommands from "./commands/shit"
import { congressusOAuthHandler, userCommands } from "./commands/user"
import announcementCommands from "./commands/announcement"
import dokCommands, { dokHandler } from "./commands/dok"
Settings.defaultZone = process.env.TIMEZONE ?? "utc"

const telegramToken = process.env.TG_TOKEN

if (!telegramToken) {
  logger.fatal("No telegram token provided, exiting")
  process.exit(1)
}

export interface MyTelegrafContext extends TelegrafContext {
  db: EntityManager<PostgreSqlDriver>
}

export interface MyKoaContext extends KoaContext {
  db: EntityManager<PostgreSqlDriver>
}

// Create bot
const bot = new Telegraf<MyTelegrafContext>(telegramToken)
let koaServer: Server

bot.use(async (ctx, next) => {
  const time = track()

  await next()

  logger.trace(
    {
      update: ctx.update,
      ...time(),
    },
    "telegram update received",
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
userCommands(bot)
announcementCommands(bot)
dokCommands(bot)
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
  bot.botInfo = await bot.telegram.getMe()
  logger.info({ botInfo: bot.botInfo }, "initialised botinfo")
  const app = new Koa()
  app.use(bodyParser())
  app.use(async (ctx, next) => {
    ctx.db = (await MikroOrm).em.fork()
    await next()
    await ctx.db.flush()
  })
  const router = new Router()
  router.post(secretPath, async ctx => {
    try {
      await bot.handleUpdate(ctx.request.body)
    } catch (error) {
      logger.fatal({ error }, "bot.handleUpdate error")
    }
    ctx.status = 200
  })
  router.post("/dok_payment", dokHandler)

  router.get("/oauth/congressus", congressusOAuthHandler)

  app.use(router.middleware())
  koaServer = app.listen(process.env.DEV_PORT ?? 80)

  logger.trace("launch")
  const subs = await (await MikroOrm).em.fork().find(ChatSubscription, { type: SubScriptionType.Status })
  try {
    const msgs = await Promise.all(subs.map(s => bot.telegram.sendMessage(s.telegramChatId, "Ben er weer")))
    logger.trace({ chats: msgs.map(m => m.chat.id) }, "sent startup message")
  } catch (error) {
    logger.error({ error }, "failed sending start status")
  }
})()

const gracefulStop = async () => {
  logger.info("Stopping due to kernel signal")
  koaServer?.close()
  stopCronJob()
  await (await MikroOrm).close(true)
  process.exit(0)
}

// Enable gracefull bot stopping with ctrl-c
process.once("SIGTERM", () => gracefulStop())
process.once("SIGINT", () => gracefulStop())
