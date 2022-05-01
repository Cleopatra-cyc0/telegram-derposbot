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
import { calculateDaysTillBirthDay, ErrorType, MyError } from "./util.js"

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
  try {
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
  } catch (error) {
    if (ctx != null) {
      ctx.reply("Ging wat mis ja")
    }
    console.error(error)
  }
}

// Create cronjob to run every day at 00:05
const job = new CronJob("5 0 * * *", sendBirthdayMessage)
async function sendDaysToBirthdayMessage(ctx: Context<Update>) {
  const username = (ctx!.message as Message.TextMessage).text.split(" ")[1]
  try {
    const birthDate = await getMemberBirthDate(username.toLocaleUpperCase())
    const { days, age } = calculateDaysTillBirthDay(birthDate)
    ctx.reply(`Nog ${days} ${days === 1 ? "dag" : "dagen"} tot hun ${age}e verjaardag`)
  } catch (error) {
    if (error instanceof MyError && error.type === ErrorType.MemberNotFound) {
      ctx.reply("Nooit van gehoord die")
    } else if (error instanceof MyError && error.type === ErrorType.PrivateInformation) {
      ctx.reply("Ja dat weet ik niet")
    } else {
      console.error("ERROR during birthday getting", error)
      ctx.reply("ja nee")
    }
  }
}

bot.command("birthday", async ctx => {
  if (ctx.message.text.trim().split(" ").length === 1) {
    await sendBirthdayMessage(ctx)
  } else {
    // someone added a member username
    sendDaysToBirthdayMessage(ctx)
  }
})

bot.command("nerd", ctx => {
  ctx.replyWithHTML(`Oh jij coole nerd\n<pre language="json">${JSON.stringify(ctx.message, null, 2)}</pre>`)
})

bot.start(async ctx => {
  await addBirthdayChat(ctx.chat.id, ctx.chat.type !== "private" ? ctx.chat.title : ctx.from.username!)
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
