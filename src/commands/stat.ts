import { DateTime } from "luxon"
import { Telegraf } from "telegraf"
import { MyTelegrafContext } from ".."
import Stat, { StatType } from "../entities/Stat"
import StatSettings from "../entities/StatSettings"
import User from "../entities/User"
import logger from "../log"
import { BotCommandScope, registerCommand } from "./commandlist"

type StatOptions = {
  type: StatType
  recordCommand: string
  undoCommand: string
  infoCommand: string
  settingCommand: string
  forwardCommand?: string
  addMessage?: (count: number) => string
}

export default async function recordStat(
  bot: Telegraf<MyTelegrafContext>,
  { type, recordCommand, undoCommand, infoCommand, settingCommand, forwardCommand, addMessage }: StatOptions,
) {
  const addMsg =
    addMessage ?? (count => (Math.random() > 0.95 ? `Gast doe normaal, al ${count}` : `Lekker hoor, je ${count}e`))
  registerCommand(recordCommand, `Sla een ${recordCommand}je op`, [
    BotCommandScope.Private,
    BotCommandScope.Groups,
    BotCommandScope.Admins,
  ])
  bot.command(recordCommand, async ctx => {
    const user = await ctx.db.getRepository(User).findOrCreate(ctx.message.from.id)
    const alternateDate = DateTime.fromISO(ctx.message.text.trim().split(" ")[1])

    const stat = new Stat(user, type)
    if (alternateDate.isValid) {
      stat.date = alternateDate
    }
    await ctx.db.persist(stat).flush()
    logger.trace({ user, type }, "new stat")
    const count = await ctx.db.count(Stat, { user, type })
    await ctx.reply(addMsg(count))

    const statSetting = await ctx.db.findOne(StatSettings, { user, statType: type })
    if (statSetting != null && statSetting.forwardChat != null) {
      try {
        await ctx.telegram.sendMessage(statSetting.forwardChat, `van ${ctx.message.from.first_name}:\n${addMsg(count)}`)
      } catch (e) {
        logger.error(
          { error: JSON.stringify(e, Object.getOwnPropertyNames(e)) },
          "Couldn't send forward message to forward chat",
        )
      }
    }
  })

  registerCommand(undoCommand, `haal een ${recordCommand}je weg`, [
    BotCommandScope.Private,
    BotCommandScope.Groups,
    BotCommandScope.Admins,
  ])
  bot.command(undoCommand, async ctx => {
    const user = await ctx.db.findOne(User, { telegramId: ctx.message.from.id })
    const stats = await ctx.db.find(Stat, { user, type })
    if (user != null) {
      if (stats.length > 0) {
        const lastStat = stats.reduce((last, curr) => (curr.date > last.date ? curr : last))
        ctx.db.remove(lastStat)
        await ctx.reply("Oke die is weg")
      } else {
        await ctx.reply("Moet je wel een hebben")
      }
    } else {
      await ctx.reply("Ik ken jou helemaal niet, flikker op")
    }
  })

  registerCommand(infoCommand, `Check je ${infoCommand}`, [
    BotCommandScope.Private,
    BotCommandScope.Groups,
    BotCommandScope.Admins,
  ])
  bot.command(infoCommand, async ctx => {
    const user = await ctx.db.getRepository(User).findOrCreate(ctx.message.from.id)
    const statSetting = await ctx.db.findOne(StatSettings, { user, statType: type })
    let startDate = statSetting?.currentPeriodStart
    let stats
    if (startDate != null) {
      stats = await ctx.db.find(Stat, { user, type, date: { $gte: startDate } })
    } else {
      stats = await ctx.db.find(Stat, { user, type })
    }
    if (user != null && stats.length > 0) {
      startDate = startDate ?? stats.reduce((last, curr) => (curr.date < last.date ? curr : last)).date
      const count = stats.length
      const weekStart = DateTime.now().set({ hour: 0, second: 0, minute: 0, weekday: 1 })
      const monthAgo = DateTime.now().minus({ month: 1 })
      const countWeek = stats.filter(stat => stat.date > weekStart).length
      const countMonth = stats.filter(stat => stat.date > monthAgo).length
      const dayAvg = count / (DateTime.now().diff(startDate).as("days") + 1)
      const weekAvg = dayAvg * 7
      const yearPrediction = dayAvg * 365
      await ctx.reply(
        `Al ${count} keer sinds ${startDate.toLocaleString(
          DateTime.DATE_MED,
        )}\n${countWeek} waren deze week\n${countMonth} waren de laatste maand\nGemiddeld ${dayAvg.toFixed(
          3,
        )} per dag\nGemiddeld ${weekAvg.toFixed(3)} per week\nop dit tempo haal je ${yearPrediction.toFixed(
          0,
        )} per jaar`,
      )
    } else {
      await ctx.reply("Ik ken jou helemaal niet, flikker op")
    }
  })

  registerCommand(settingCommand, `Zet de startdatum vanaf wanneer de bot je ${infoCommand} telt`, [
    BotCommandScope.Private,
    BotCommandScope.Groups,
    BotCommandScope.Admins,
  ])
  bot.command(settingCommand, async ctx => {
    const startDate = DateTime.fromISO(ctx.message.text.trim().split(" ")[1])
    if (startDate.isValid) {
      const user = await ctx.db.getRepository(User).findOrCreate(ctx.from.id)
      const repo = ctx.db.getRepository(StatSettings)
      await repo.setStatStartDate(type, user, startDate)
      await ctx.reply(`Startdatum is nu ${startDate.toLocaleString(DateTime.DATE_MED)}`)
    } else {
      await ctx.reply("Geen geldige datum")
    }
  })

  if (forwardCommand != null) {
    registerCommand(settingCommand, `Stel een chat in om je ${recordCommand} naar door te sturen`, [
      BotCommandScope.Private,
      BotCommandScope.Groups,
      BotCommandScope.Admins,
    ])
    bot.command(forwardCommand, async ctx => {
      const chatIdStr = ctx.message.text.trim().split(" ")[1]
      const chatId = parseInt(chatIdStr)
      if (!isNaN(chatId)) {
        try {
          await bot.telegram.sendMessage(chatId, "even testen of ik hier kan posten")
          const user = await ctx.db.getRepository(User).findOrCreate(ctx.from.id)
          await ctx.db.getRepository(StatSettings).setForwardChat(type, user, chatId)
          await ctx.reply(`Je ${recordCommand} wordt nu ook naar ${chatId} gestuurd`)
        } catch (e) {
          logger.debug(
            { chatId, error: JSON.stringify(e, Object.getOwnPropertyNames(e)) },
            "Could not forward message to requested forward chat",
          )
          await ctx.reply("Ik kan niet naar die chat")
        }
      } else {
        await ctx.reply("Geen geldige chatid")
      }
    })
  }
}
