import "dotenv/config"
import { Context, Telegraf } from "telegraf"
import { CronJob } from "cron"
import {
  getBirthdayChats,
  getStatusChats,
  getBirthDayMembers,
  addBirthdayChat,
  removeBirthdayChat,
  getMemberBirthDate,
} from "./model.js"
import enableTrivia from "./trivia.js"
import { Update, Message } from "telegraf/typings/core/types/typegram"

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
async function sendDaysToBirthdayMessage(ctx: Context<Update>) {
  const username = (ctx!.message as Message.TextMessage).text.split(" ")[1]
  try {
    const birthDate = await getMemberBirthDate(username)
    const nextBirthDay = new Date(birthDate)
    nextBirthDay.setFullYear(new Date().getFullYear() + 1)
    const totalSeconds = nextBirthDay.getTime() - Date.now()
    const days = Math.floor(totalSeconds / 86400000)
    const nextAge = Math.abs(new Date(Date.now() - birthDate.getTime()).getFullYear() - 1970) + 1
    ctx.reply(`Nog ${days} dagen tot hun ${nextAge}e verjaardag`)
  } catch (error) {
    ctx.reply("ja nee")
  }
}

bot.command("birthday", async ctx => {
  if (ctx.message.text.trim() === "/birthday") {
    await sendBirthdayMessage(ctx)
  } else {
    // someone added a member username
    sendDaysToBirthdayMessage(ctx)
  }
})

const sprangId = process.env.SPRANG_ID
if (sprangId != null) {
  bot.command("sprang", async ctx => {
    const birthDate = await getMemberBirthDate(sprangId)
    const nextBirthDay = new Date(birthDate)
    nextBirthDay.setFullYear(new Date().getFullYear() + 1)
    const totalSeconds = nextBirthDay.getTime() - Date.now()
    const days = Math.floor(totalSeconds / 86400000)
    const nextAge = Math.abs(new Date(Date.now() - birthDate.getTime()).getFullYear() - 1970) + 1
    ctx.reply(`Nog ${days} dagen tot sprangs ${nextAge}e verjaardag`)
  })
}

bot.start(async ctx => {
  await addBirthdayChat(ctx.chat.id)
  ctx.reply("I will now announce birthdays at 00:05")
})
bot.command("cancel", async ctx => {
  if (ctx.chat.type === "private" || (await ctx.getChatAdministrators()).map(m => m.user.id).includes(ctx.from.id)) {
    await removeBirthdayChat(ctx.chat.id)
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
  console.error("K, bye")
  bot.stop(reason)
  job.stop()
}

// Enable gracefull bot stopping with ctrl-c
process.once("SIGTERM", () => gracefulStop("SIGTERM"))
process.once("SIGINT", () => gracefulStop("SIGINT"))
