import { DateTime } from "luxon"
import { Telegraf } from "telegraf"
import { MyTelegrafContext } from "../index.js"
import Stat from "../entities/Stat.js"
import User from "../entities/User.js"
import logger from "../log.js"
import { BotCommandScope, registerCommand } from "./commandlist.js"

export default async function recordStat(
  bot: Telegraf<MyTelegrafContext>,
  type: string,
  recordCommand: string,
  undoCommand: string,
  infoCommand: string,
) {
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
    if (Math.random() > 0.95) {
      await ctx.reply(`Gast doe normaal, al ${count}`)
    } else {
      await ctx.reply(`Lekker hoor, je ${count}e`)
    }
  })

  registerCommand(recordCommand, `haal een ${recordCommand}je weg`, [
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
    const user = await ctx.db.findOne(User, { telegramId: ctx.message.from.id })
    const stats = await ctx.db.find(Stat, { user, type })
    if (user != null && stats.length > 0) {
      const firstStat = stats.reduce((first, curr) => (curr.date < first.date ? curr : first))
      const count = stats.length
      const todayStart = DateTime.now().set({ hour: 0, second: 0, minute: 0 })
      const countToday = stats.filter(stat => stat.date > todayStart).length
      await ctx.reply(
        `Al ${count} keer sinds ${firstStat.date.toLocaleString(DateTime.DATE_MED)}\n${countToday} waren vandaag`,
      )
    } else {
      await ctx.reply("Ik ken jou helemaal niet, flikker op")
    }
  })
}
