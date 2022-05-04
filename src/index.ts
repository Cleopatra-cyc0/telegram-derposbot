import "dotenv/config"
import { Context, Telegraf } from "telegraf"
import logger, { track } from "./log"
import { Settings } from "luxon"
import { EntityManager } from "@mikro-orm/core"
import { PostgreSqlDriver } from "@mikro-orm/postgresql"
import MikroOrm from "./database"
import ChatSubscription, { SubScriptionType } from "./entities/ChatSubscription"
import subscriptionCommands from "./commands/subscription"
import birthdayCommands from "./commands/birthday"
import triviaCommands from "./trivia"
Settings.defaultZone = process.env.TIMEZONE ?? "utc"

const telegramToken = process.env.TG_TOKEN
const congressusToken = process.env.CONGRESSUS_TOKEN
const webHookDomain = process.env.WEBHOOK_DOMAIN

if (!telegramToken) {
  logger.fatal("No telegram token provided, exiting")
  process.exit(1)
}

if (!congressusToken) {
  logger.fatal("No congressus token provided, exiting")
  process.exit(2)
}

export interface MyContext extends Context {
  db: EntityManager<PostgreSqlDriver>
}

// Create bot
const bot = new Telegraf<MyContext>(telegramToken)

bot.on("message", async (ctx, next) => {
  const time = track()
  let possibleError: Error | undefined
  try {
    await next()
  } catch (error) {
    possibleError = error as Error
    ctx.reply("Ja ging niet lekker")
  }
  if (possibleError == null) {
    logger.trace(
      {
        message: ctx.message,
        ...time(),
      },
      "message",
    )
  } else {
    logger.error(
      {
        error: possibleError,
        message: ctx.message,
        ...time(),
      },
      "error during message handling",
    )
  }
})

bot.use(async (ctx, next) => {
  ctx.db = (await MikroOrm).em.fork()
  await next()
  ctx.db.flush()
})

const stopCronJob = birthdayCommands(bot)
triviaCommands(bot)
subscriptionCommands(bot)

let botLaunchPromise

if (webHookDomain) {
  // launch with webhook
  botLaunchPromise = bot.launch({
    webhook: {
      domain: webHookDomain,
      port: 80,
    },
  })
} else {
  // No webhook domain, launch with polling
  botLaunchPromise = bot.launch()
}
botLaunchPromise
  .then(() => logger.trace("launch"))
  .then(() => MikroOrm)
  .then(({ em }) => em.fork().find(ChatSubscription, { type: SubScriptionType.Status }))
  .then(subs => Promise.all(subs.map(s => bot.telegram.sendMessage(s.telegramChatId, "Ben er weer"))))
  .then(msgs => logger.trace({ chats: msgs.map(m => m.chat.id) }, "sent startup message"))
  .catch(error => logger.error({ error }, "failed sending start status"))

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
