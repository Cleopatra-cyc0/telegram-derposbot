import "dotenv/config"
import { Context, Telegraf } from "telegraf"
import { CronJob } from "cron"
import logger, { track } from "./log"
import enableTrivia from "./trivia"
import { enumKeys, sendBirthdayMessage, sendDaysToBirthdayMessage } from "./util"
import { Settings } from "luxon"
import { EntityManager } from "@mikro-orm/core"
import { PostgreSqlDriver } from "@mikro-orm/postgresql"
import db from "./database"
import ChatSubscription, { SubScriptionType } from "./entities/ChatSubscription"
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
  logger.info(
    {
      message: ctx.message,
      ...time(),
      error: possibleError,
    },
    possibleError != null ? "uncaught error during message" : "message",
  )
})

bot.use(async (ctx, next) => {
  ctx.db = (await db).em.fork()
  await next()
  ctx.db.flush()
})

// Create cronjob to run every day at 00:05
const job = new CronJob(
  "0 5 0 * * *",
  () => sendBirthdayMessage(bot),
  undefined,
  undefined,
  process.env.TIMEZONE ?? "Europe/Amsterdam",
)

bot.command("birthday", async ctx => {
  if (ctx.message.text.trim().split(" ").length === 1) {
    await sendBirthdayMessage(bot, ctx)
  } else {
    // someone added a member username
    sendDaysToBirthdayMessage(ctx)
  }
})

bot.command("nerd", ctx => {
  ctx.replyWithHTML(`Oh jij coole nerd\n<pre language="json">${JSON.stringify(ctx.message, null, 2)}</pre>`)
})

bot.command("isdebaropen", ctx => {
  ctx.reply("misschien")
})

bot.start(async ctx => {
  const typeRaw = ctx.message.text.split(" ")[1]?.toLowerCase()
  let type: SubScriptionType | null = null
  for (const key of enumKeys(SubScriptionType)) {
    if (typeRaw === SubScriptionType[key]) {
      type = typeRaw
      break
    }
  }
  type = type ?? SubScriptionType.Birthday
  if ((await ctx.db.count(ChatSubscription, { telegramChatId: ctx.chat.id.toString(), type })) === 0) {
    const sub = new ChatSubscription(ctx.chat.id.toString(), type)
    ctx.db.persist(sub)
    ctx.reply(`Ja prima${type === SubScriptionType.Birthday ? ", je hoort het om 00:05" : ""}`)
  } else {
    ctx.reply("Was al")
  }
})
bot.command("cancel", async ctx => {
  const typeRaw = ctx.message.text.split(" ")[1]?.toLowerCase()
  let type: SubScriptionType | null = null
  for (const key of enumKeys(SubScriptionType)) {
    if (typeRaw === SubScriptionType[key]) {
      type = typeRaw
      break
    }
  }
  type = type ?? SubScriptionType.Birthday
  if (ctx.chat.type === "private" || (await ctx.getChatMember(ctx.from.id)).status === "administrator") {
    const sub = await ctx.db.findOne(ChatSubscription, { type, telegramChatId: ctx.chat.id.toString() })
    if (sub != null) {
      ctx.db.remove(sub)
      ctx.reply("joe")
    } else {
      ctx.reply("Was al niet joh")
    }
  } else {
    ctx.reply("mag niet")
  }
})

enableTrivia(bot)

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
  .then(() => db)
  .then(({ em }) => em.fork().find(ChatSubscription, { type: SubScriptionType.Status }))
  .then(subs => Promise.all(subs.map(s => bot.telegram.sendMessage(s.telegramChatId, "Ben er weer"))))
  .catch(error => logger.error({ error }, "failed sending start status"))

job.start()
logger.info("cron job started")

const gracefulStop = async (reason: string) => {
  logger.info("Stopping due to kernel signal")
  bot.stop(reason)
  job.stop()
  await (await db).close(true)
  process.exit(0)
}

// Enable gracefull bot stopping with ctrl-c
process.once("SIGTERM", () => gracefulStop("SIGTERM"))
process.once("SIGINT", () => gracefulStop("SIGINT"))
