import { Context, Telegraf } from "telegraf"
import { Message, Update } from "telegraf/typings/core/types/typegram"
import { getBirthdayChats, getBirthDayMembers, getMemberBirthDate } from "./model.js"
import logger, { track } from "./log.js"
import { DateTime, Interval } from "luxon"

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
  const nextBirthDay = birthDate.set({ year: DateTime.now().year })
  // Calculate next birthday requires logic for checking if birthday has passed
  //nextBirthDay.setFullYear(new Date().getFullYear() + 1)
  const now = DateTime.now()
  if (now > nextBirthDay) {
    nextBirthDay.plus({ year: 1 })
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

export async function sendDaysToBirthdayMessage(ctx: Context<Update>) {
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

export async function sendBirthdayMessage(bot: Telegraf, ctx?: Context<Update>) {
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
    const time = track()
    for (const chatId of chats) {
      bot.telegram.sendMessage(chatId, message)
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
