import "dotenv/config"
import { Telegraf } from "telegraf"
import { CronJob } from "cron"
import { getBirthdayChats, getStatusChats, getBirthDayMembers, checkIsAdmin } from "./model.js"
import enableTrivia from "./trivia.js"
import { Update } from "telegraf/typings/core/types/typegram"

const telegramToken = process.env.TG_TOKEN
const congressusToken = process.env.CONGRESSUS_TOKEN
const dbConnctionString = process.env.DB_CONNECTION
const webHookDomain = process.env.WEBHOOK_DOMAIN

if (!telegramToken) {
  console.error("No telegram token provided, exiting")
  process.exit(1)
}

if (!congressusToken) {
  console.error("No congressus token provided, exiting")
  process.exit(2)
}

// Create db connection and bot

const bot = new Telegraf(telegramToken)

async function sendBirthdayMessage(ctx?: Context<Update>) {
  const birthDayMembers = await getBirthDayMembers()
  let message
  if (birthDayMembers.length === 0) {
    message = "Helaas is er niemand jarig vandaag"
  } else if (birthDayMembers.length === 1) {
    message = `Gefeliciteerd! ${birthDayMembers[0]}!`
  } else {
    message = `Gefeliciteerd!`
    for (const name of birthDayMembers) {
      message = `${message}\n- ${name}`
    }
  }
  const chats = await getBirthdayChats()

  if (ctx) {
    ctx.reply(message)
  } else {
    for (const chatId of chats) {
      bot.telegram.sendMessage(chatId, message)
    }
  }
}

// Create cronjob to run every day at 00:05
const job = new CronJob("5 0 * * *", sendBirthdayMessage)

bot.command("birthday", sendBirthdayMessage)

bot.command("disable", async ctx => {
  const isAdmin = await checkIsAdmin(ctx.from.id)
  if (isAdmin) {
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
  console.error("K, bye")
  bot.stop(reason)
  job.stop()
}

// Enable gracefull bot stopping with ctrl-c
process.once("SIGTERM", () => gracefulStop("SIGTERM"))
process.once("SIGINT", () => gracefulStop("SIGINT"))
