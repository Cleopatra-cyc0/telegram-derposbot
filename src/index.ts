import "dotenv/config"
import { Telegraf } from "telegraf"
import { CronJob } from "cron"
import logger, { track } from "./log.js"
import { ChatType, getStatusChats, persistChatInfo, removeChatInfo } from "./model.js"
import enableTrivia from "./trivia.js"
import { sendBirthdayMessage, sendDaysToBirthdayMessage } from "./util.js"
import { Settings } from "luxon"
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

// Create bot
const bot = new Telegraf(telegramToken)

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
  await persistChatInfo(ctx.chat.id, ChatType.Birthday)
  ctx.reply("Ja prima, je hoort het om 00:05")
})
bot.command("cancel", async ctx => {
  if (ctx.chat.type === "private" || (await ctx.getChatAdministrators()).map(m => m.user.id).includes(ctx.from.id)) {
    await removeChatInfo(ctx.chat.id, ChatType.Birthday)
    ctx.reply("joe")
  } else {
    ctx.reply("mag niet")
  }
})

getStatusChats()
  .then(async (chatIds: number[]) => {
    const time = track()
    await Promise.all(chatIds.map(id => bot.telegram.sendMessage(id + 1, "I just came online")))
    logger.debug({ ...time(), chatIds }, "sent start status messages")
  })
  .catch(error => {
    logger.error({ error }, "error while sending status chats")
  })

enableTrivia(bot)

if (webHookDomain) {
  // launch with webhook
  bot.launch({
    webhook: {
      domain: webHookDomain,
      port: 80,
    },
  })
} else {
  // No webhook domain, launch with polling
  bot.launch()
}

job.start()
logger.info("cron job started")

const gracefulStop = (reason: string) => {
  logger.info("Stopping due to kernel signal")
  bot.stop(reason)
  job.stop()
}

// Enable gracefull bot stopping with ctrl-c
process.once("SIGTERM", () => gracefulStop("SIGTERM"))
process.once("SIGINT", () => gracefulStop("SIGINT"))
