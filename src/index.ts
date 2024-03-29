import "dotenv/config"
import { Context as TelegrafContext, Telegraf, Telegram } from "telegraf"
import logger, { track } from "./log"
import { Settings } from "luxon"
import { EntityManager } from "@mikro-orm/postgresql"
import ngrok from "ngrok"
import Koa, { Context as KoaContext } from "koa"
import bodyParser from "koa-bodyparser"
import Router from "@koa/router"
import { Server } from "http"
import MikroOrm from "./database"
import ChatSubscription, { SubScriptionType } from "./entities/ChatSubscription"
import subscriptionCommands from "./commands/subscription"
import birthdayCommands from "./commands/birthday"
import triviaCommands, { customMessageHandler } from "./commands/trivia"
import recordStat from "./commands/stat"
import { congressusOAuthHandler, userCommands } from "./commands/user"
import announcementCommands from "./commands/announcement"
import dokCommands, { dokHandler } from "./commands/dok"
import { startTaskRunner } from "./taskRunner"
import commandList from "./commands/commandlist"
import quoteCommands from "./commands/quote"
import { Update } from "telegraf/typings/core/types/typegram"
import chatGpt from "./commands/chatgpt"
import { StatType } from "./entities/Stat"
import { P } from "pino"
Settings.defaultZone = process.env.TIMEZONE ?? "utc"

const telegramToken = process.env.TG_TOKEN

if (!telegramToken) {
  logger.fatal("No telegram token provided, exiting")
  process.exit(1)
}

export interface MyTelegrafContext extends TelegrafContext {
  db: EntityManager
}

export interface MyKoaContext extends KoaContext {
  db: EntityManager
  telegram: Telegram
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
  await ctx.db.flush()
})

const stopCronJob = birthdayCommands(bot)
const stopTaskRunner = startTaskRunner(bot.telegram)
userCommands(bot)
triviaCommands(bot)
subscriptionCommands(bot)
recordStat(bot, {
  type: StatType.Shit,
  recordCommand: "poep",
  undoCommand: "poepsie",
  infoCommand: "poepstats",
  settingCommand: "poepstart",
  forwardCommand: "poepforward",
})
recordStat(bot, {
  type: StatType.Blowjob,
  recordCommand: "pijp",
  undoCommand: "pijpsie",
  infoCommand: "pijpstats",
  settingCommand: "pijpstart",
})
recordStat(bot, {
  type: StatType.Cunnilingus,
  recordCommand: "bef",
  undoCommand: "befsie",
  infoCommand: "befstats",
  settingCommand: "befstart",
})
recordStat(bot, {
  type: StatType.Puke,
  recordCommand: "barf",
  undoCommand: "unbarf",
  infoCommand: "barfstats",
  settingCommand: "barfstart",
})
recordStat(bot, {
  type: StatType.Gym,
  recordCommand: "gain",
  undoCommand: "gainloss",
  infoCommand: "gains",
  settingCommand: "gainstart",
  addMessage: count => `Lekker pompen, al ${count}`,
})
recordStat(bot, {
  type: StatType.Gym,
  recordCommand: "gayn",
  undoCommand: "gaynloss",
  infoCommand: "gayns",
  settingCommand: "gaynstart",
  addMessage: count => {
    const random = Math.random()
    const options = [
      `Poah steek die maar in je reet, al ${count}`,
      `Lekker bezig weer, laat de mannetjes maar zien hoe het moet met je ${count}e`,
      `Als jij het niet doet, wie doet het dan wel hè?\nal ${count}`,
      `Lekker slurpen aan de ${count}e lolly`,
      `Hard werk wel, dat onderschat je vaak. Al ${count}`,
      `Poepen is dr niks bij, al ${count}`,
      `De beste pikkelikker in een straal van 30 meter, al ${count}`,
      `Daar kan Gerard Joling nog een puntje aan zuigen, al ${count}`,
      `Echt slurpen tot die laatste druppel, dat kan alleen jij. Al ${count}`,
    ]
    return options[Math.floor(random * options.length)]
  },
})
announcementCommands(bot)
dokCommands(bot)
quoteCommands(bot)
chatGpt(bot)
;(async () => {
  let domain
  if (process.env.WEBHOOK_DOMAIN != null && process.env.WEBHOOK_DOMAIN != "") {
    domain = process.env.WEBHOOK_DOMAIN
  } else if (process.env.DEV_PORT != null && process.env.DEV_PORT != "") {
    domain = await ngrok.connect({
      port: parseInt(process.env.DEV_PORT),
      authtoken: process.env.NGROK_TOKEN,
    })
    logger.info({ domain }, "using ngrok tunnel")
  } else {
    logger.error("specify either WEBHOOK_DOMAIN or DEV_PORT")
    process.exit(9)
  }

  const secretPath = `/telegraf/${bot.secretPathComponent()}`

  await bot.telegram.setWebhook(`${domain}${secretPath}`)
  bot.botInfo = await bot.telegram.getMe()
  logger.info({ botInfo: bot.botInfo }, "initialised botinfo")
  const app = new Koa()
  app.use(bodyParser())
  app.use(async (ctx, next) => {
    ctx.db = (await MikroOrm).em.fork()
    ctx.telegram = bot.telegram
    await next()
    await ctx.db.flush()
  })
  const router = new Router()
  router.post(secretPath, async ctx => {
    try {
      await bot.handleUpdate(ctx.request.body as unknown as Update)
    } catch (error) {
      logger.fatal({ error: JSON.stringify(error, Object.getOwnPropertyNames(error)) }, "bot.handleUpdate error")
    }
    ctx.status = 200
  })
  router.post("/dok_payment", dokHandler)

  router.get("/oauth/congressus", congressusOAuthHandler)

  router.post("/custom-message", customMessageHandler(bot))

  app.use(router.middleware())
  koaServer = app.listen(process.env.DEV_PORT ?? 80)

  logger.trace("launch")
  await commandList(bot)
  const subs = await (await MikroOrm).em.fork().find(ChatSubscription, { type: SubScriptionType.Status })
  try {
    const msgs = await Promise.all(subs.map(s => bot.telegram.sendMessage(s.telegramChatId, "Ben er weer")))
    logger.trace({ chats: msgs.map(m => m.chat.id) }, "sent startup message")
  } catch (error) {
    logger.error({ error: JSON.stringify(error, Object.getOwnPropertyNames(error)) }, "failed sending start status")
  }
})()

const gracefulStop = async () => {
  logger.info("Stopping due to kernel signal")
  koaServer?.close()
  stopCronJob()
  stopTaskRunner()
  await (await MikroOrm).close(true)
  process.exit(0)
}

// Enable gracefull bot stopping with ctrl-c
process.once("SIGTERM", () => gracefulStop())
process.once("SIGINT", () => gracefulStop())
