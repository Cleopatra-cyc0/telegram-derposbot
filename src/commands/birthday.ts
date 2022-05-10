import { CronJob } from "cron"
import { Telegraf } from "telegraf"
import { MyTelegrafContext } from ".."
import MikroOrm from "../database"
import ChatSubscription, { SubScriptionType } from "../entities/ChatSubscription"
import User from "../entities/User"
import logger, { track } from "../log"
import { getBirthDayMembers, getMemberBirthDate } from "../model"
import { calculateDaysTillBirthDay, ErrorType, MyError } from "../util"

export default function birthdayCommands(bot: Telegraf<MyTelegrafContext>) {
  bot.command("birthday", async ctx => {
    await ctx.reply("die is vervangen door /wieiserjarig en /mijnverjaardag")
  })

  bot.command("wieiserjarig", ctx => sendBirthdayMessage(bot, ctx))

  bot.command("mijnverjaardag", async ctx => {
    const user = await ctx.db.findOne(User, { telegramId: ctx.message.from.id })
    if (user != null && user.congressusId != null) {
      try {
        const birthDate = await getMemberBirthDate(user.congressusId)
        const { days, age } = calculateDaysTillBirthDay(birthDate)
        ctx.reply(`Nog ${days} ${days === 1 ? "dag" : "dagen"} tot jouw ${age}e verjaardag`)
      } catch (error) {
        if (error instanceof MyError) {
          switch (error.type) {
            case ErrorType.MemberNotFound:
              logger.error({ user }, "retrieved invalid member id from database")
              await ctx.reply("Nou heb je iets heel interessants gedaan")
              break
            case ErrorType.PrivateInformation:
              logger.trace({ user }, "member tried to get own private birthday")
              await ctx.reply("Je zei zelf dat ik dat niet mocht zeggen")
              break
            case ErrorType.CongressusNetworkError:
              logger.error("congressus error after retries")
              await ctx.reply("Congressus doet kut")
              break
          }
        } else {
          logger.error({ error }, "unexpected error during birthday getting")
          await ctx.reply("ja nee")
        }
      }
    } else {
      await ctx.reply("je moet eerst even connecten, gebruik het /connect command (in een privechat)")
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

async function sendBirthdayMessage(bot: Telegraf<MyTelegrafContext>, ctx?: MyTelegrafContext) {
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
    await ctx.reply(message)
  } else {
    const time = track()
    for (const { telegramChatId } of chats) {
      await bot.telegram.sendMessage(telegramChatId, message)
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
