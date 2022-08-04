import { CronJob } from "cron"
import { Telegraf } from "telegraf"
import { MyTelegrafContext } from ".."
import MikroOrm from "../database"
import ChatSubscription, { SubScriptionType } from "../entities/ChatSubscription"
import User from "../entities/User"
import logger, { track } from "../log"
import { getBirthDayMembers, getMemberBirthDate } from "../model"
import { calculateDaysTillBirthDay, ErrorType, MyError } from "../util"
import { BotCommandScope, registerCommand } from "./commandlist"

const superAdminUserId = parseInt(process.env.SUPER_ADMIN_USER_ID as string)

export default function birthdayCommands(bot: Telegraf<MyTelegrafContext>) {
  bot.command("birthday", async ctx => {
    await ctx.reply("die is vervangen door /wieiserjarig en /mijnverjaardag")
  })
  registerCommand("wieiserjarig", "Vertelt wie er vandaag jarig zijn", [
    BotCommandScope.Private,
    BotCommandScope.Groups,
    BotCommandScope.Admins,
  ])
  bot.command("wieiserjarig", ctx => sendBirthdayMessage(bot, ctx))

  registerCommand("mijnverjaardag", "Hoe lang nog tot je jarig bent", [
    BotCommandScope.Private,
    BotCommandScope.Groups,
    BotCommandScope.Admins,
  ])
  bot.command("mijnverjaardag", async ctx => {
    const user = await ctx.db.findOne(User, { telegramId: ctx.message.from.id })
    if (user != null && user.congressusId != null) {
      try {
        const birthDate = await getMemberBirthDate(user.congressusId)
        const birthdayInfo = calculateDaysTillBirthDay(birthDate)
        // EASTER EGG
        if (ctx.from.id === superAdminUserId) {
          birthdayInfo.age = 22
        }
        ctx.reply(
          `Nog ${birthdayInfo.days} ${birthdayInfo.days === 1 ? "dag" : "dagen"} tot jouw ${
            birthdayInfo.age
          }e verjaardag`,
        )
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
          logger.error(
            { error: JSON.stringify(error, Object.getOwnPropertyNames(error)) },
            "unexpected error during birthday getting",
          )
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
  let message
  try {
    const birthDayMembers = await getBirthDayMembers()

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
  } catch (error) {
    message = "Er ging iets mis met de verjaardagen"
    logger.error(
      { error: JSON.stringify(error, Object.getOwnPropertyNames(error)) },
      "Error while getting birthdays from congressus",
    )
  }
  let chatSubscriptionRepo
  if (ctx != null) {
    chatSubscriptionRepo = ctx.db.getRepository(ChatSubscription)
  } else {
    chatSubscriptionRepo = (await MikroOrm).em.fork().getRepository(ChatSubscription)
  }

  const chats = await chatSubscriptionRepo.find({ type: SubScriptionType.Birthday })

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
