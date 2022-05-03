import { Telegraf } from "telegraf"
import { Message } from "telegraf/typings/core/types/typegram"
import { getBirthDayMembers, getMemberBirthDate } from "./model"
import logger, { track } from "./log"
import { DateTime, Interval } from "luxon"
import { MyContext } from "."
import ChatSubscription, { SubScriptionType } from "./entities/ChatSubscription"
import db from "./database"

/**
 * Checks whether the provided date is the same date as another
 * @param one The first date to check
 * @param two The date to check against. If not provided, today will be used
 * @returns A boolean indicating same date or not
 */
export function IsSameDate(one: DateTime | string, two: DateTime | string = DateTime.now()) {
  if (typeof one === "string") {
    one = DateTime.fromISO(one)
  }
  if (typeof two === "string") {
    two = DateTime.fromISO(two)
  }
  return one.hasSame(two, "day") && one.hasSame(two, "month")
}

/**
 * Calculate the amount of days untill someone's birthday and also what age they'll turn
 * @param birthDate The date someone was born
 */
function calculateDaysTillBirthDay(birthDate: DateTime): { days: number; age: number } {
  let nextBirthDay = birthDate.set({ year: DateTime.now().year })
  // Calculate next birthday requires logic for checking if birthday has passed
  //nextBirthDay.setFullYear(new Date().getFullYear() + 1)
  const now = DateTime.now()
  if (now > nextBirthDay) {
    nextBirthDay = nextBirthDay.plus({ year: 1 })
  }
  const days = Math.floor(Interval.fromDateTimes(now, nextBirthDay).length("days") + 1)
  const nextAge = Math.ceil(Interval.fromDateTimes(birthDate, now).length("year"))
  return { days, age: nextAge }
}

export enum ErrorType {
  MemberNotFound,
  PrivateInformation,

  CongressusNetworkError,
}

export class MyError extends Error {
  public readonly type: ErrorType
  constructor(type: ErrorType) {
    super(type.toString())
    this.type = type
  }
}

export async function sendDaysToBirthdayMessage(ctx: MyContext) {
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

export async function sendBirthdayMessage(bot: Telegraf<MyContext>, ctx?: MyContext) {
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
    chatSubRepo = (await db).em.fork().getRepository(ChatSubscription)
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

export function enumKeys<O extends object, K extends keyof O = keyof O>(obj: O): K[] {
  return Object.keys(obj).filter(k => Number.isNaN(+k)) as K[]
}
