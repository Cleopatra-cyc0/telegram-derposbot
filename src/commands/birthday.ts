import { CronJob } from "cron"
import { Telegraf } from "telegraf"
import { Message } from "telegraf/typings/core/types/typegram"
import { MyContext } from ".."
import MikroOrm from "../database"
import ChatSubscription, { SubScriptionType } from "../entities/ChatSubscription"
import logger, { track } from "../log"
import { getBirthDayMembers, getMemberBirthDate } from "../model"
import { calculateDaysTillBirthDay, ErrorType, MyError } from "../util"

export default function birthdayCommands(bot: Telegraf<MyContext>) {
  bot.command("birthday", async ctx => {
    if (ctx.message.text.trim().split(" ").length === 1) {
      await sendBirthdayMessage(bot, ctx)
    } else {
      // someone added a member username
      sendDaysToBirthdayMessage(ctx)
    }
  })

  // Create cronjob to run every day at 00:05
  const job = new CronJob(
    "0 5 0 * * *",
    () => sendBirthdayMessage(bot),
    undefined,
    undefined,
    process.env.TIMEZONE ?? "Europe/Amsterdam",
  )
  job.start()
  logger.info("cron job started")
  return () => job.stop()
}

async function sendBirthdayMessage(bot: Telegraf<MyContext>, ctx?: MyContext) {
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
  let chatSubRepo
  if (ctx != null) {
    chatSubRepo = ctx.db.getRepository(ChatSubscription)
  } else {
    chatSubRepo = (await MikroOrm).em.fork().getRepository(ChatSubscription)
  }

  const chats = await chatSubRepo.find({ type: SubScriptionType.Birthday })

  if (ctx) {
    ctx.reply(message)
  } else {
    const time = track()
    for (const { telegramChatId } of chats) {
      bot.telegram.sendMessage(telegramChatId, message)
    }
    logger.info(
      {
        ...time(),
        chats,
      },
      "sent daily birthday",
    )
  }
}

async function sendDaysToBirthdayMessage(ctx: MyContext) {
  const username = (ctx.message as Message.TextMessage).text.split(" ")[1]
  try {
    const birthDate = await getMemberBirthDate(username.toLocaleUpperCase())
    const { days, age } = calculateDaysTillBirthDay(birthDate)
    ctx.reply(`Nog ${days} ${days === 1 ? "dag" : "dagen"} tot hun ${age}e verjaardag`)
  } catch (error) {
    if (error instanceof MyError) {
      switch (error.type) {
        case ErrorType.MemberNotFound:
          ctx.reply("Nooit van gehoord die")
          break
        case ErrorType.PrivateInformation:
          ctx.reply("Ja dat weet ik niet")
          break
        case ErrorType.CongressusNetworkError:
          ctx.reply("Congressus doet kut")
          break
      }
    } else {
      logger.error({ error }, "ERROR during birthday getting")
      ctx.reply("ja nee")
    }
  }
}
