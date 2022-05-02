import "dotenv/config"
import { Telegraf } from "telegraf"
import { CronJob } from "cron"
import logger from "./log.js"
import { ChatType, getStatusChats, persistChatInfo, removeChatInfo } from "./model.js"
import enableTrivia from "./trivia.js"
import { sendBirthdayMessage, sendDaysToBirthdayMessage } from "./util.js"

const telegramToken = process.env.TG_TOKEN
const congressusToken = process.env.CONGRESSUS_TOKEN
const webHookDomain = process.env.WEBHOOK_DOMAIN

if (!telegramToken) {
  logger.error("No telegram token provided, exiting")
  process.exit(1)
}

if (!congressusToken) {
  logger.error("No congressus token provided, exiting")
  process.exit(2)
}

// Create bot
const bot = new Telegraf(telegramToken)

// Create cronjob to run every day at 00:05
const job = new CronJob("5 0 * * *", () => sendBirthdayMessage(bot))

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
  ctx.reply("I will now announce birthdays at 00:05")
})
bot.command("cancel", async ctx => {
  if (ctx.chat.type === "private" || (await ctx.getChatAdministrators()).map(m => m.user.id).includes(ctx.from.id)) {
    await removeChatInfo(ctx.chat.id, ChatType.Birthday)
    ctx.reply("K, I'll stop")
  } else {
    ctx.reply("hehe nice try")
  }
})

getStatusChats().then((chatIds: number[]) => {
  for (const chatId of chatIds) {
    bot.telegram.sendMessage(chatId, "I just came online")
  }
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

const gracefulStop = (reason: string) => {
  logger.error("K, bye")
  bot.stop(reason)
  job.stop()
}

// Enable gracefull bot stopping with ctrl-c
process.once("SIGTERM", () => gracefulStop("SIGTERM"))
process.once("SIGINT", () => gracefulStop("SIGINT"))
