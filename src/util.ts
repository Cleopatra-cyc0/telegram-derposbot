import { Context, Telegraf } from "telegraf"
import { Message, Update } from "telegraf/typings/core/types/typegram"
import { getBirthdayChats, getBirthDayMembers, getMemberBirthDate } from "./model.js"

/**
 * Checks whether the provided date is the same date as another
 * @param one The first date to check
 * @param two The date to check against. If not provided, today will be used
 * @returns A boolean indicating same date or not
 */
export function IsSameDate(one: Date | string, two: Date | string = new Date()) {
  if (typeof one === "string") {
    one = new Date(one)
  }
  if (typeof two === "string") {
    two = new Date(two)
  }
  return one.getDate() === two.getDate() && one.getMonth() === two.getMonth()
}

/**
 * Calculate the amount of days untill someone's birthday and also what age they'll turn
 * @param birthDate The date someone was born
 */
function calculateDaysTillBirthDay(birthDate: Date): { days: number; age: number } {
  const nextBirthDay = new Date(birthDate)
  // Calculate next birthday requires logic for checking if birthday has passed
  //nextBirthDay.setFullYear(new Date().getFullYear() + 1)
  const now = new Date()
  if (
    now.getMonth() > birthDate.getMonth() ||
    (now.getMonth() === birthDate.getMonth() && now.getDate() > birthDate.getDate())
  ) {
    nextBirthDay.setFullYear(new Date().getFullYear() + 1)
  } else {
    nextBirthDay.setFullYear(new Date().getFullYear())
  }
  const totalSeconds = nextBirthDay.getTime() - Date.now()
  const days = Math.ceil(totalSeconds / 86400000)
  const nextAge = Math.abs(new Date(Date.now() - birthDate.getTime()).getFullYear() - 1970) + 1
  return { days, age: nextAge }
}

export enum ErrorType {
  MemberNotFound,
  PrivateInformation,
}

export class MyError extends Error {
  public readonly type: ErrorType
  constructor(type: ErrorType) {
    super(type.toString())
    this.type = type
  }
}

export async function sendDaysToBirthdayMessage(ctx: Context<Update>) {
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

export async function sendBirthdayMessage(bot: Telegraf, ctx?: Context<Update>) {
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
