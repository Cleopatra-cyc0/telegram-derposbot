import { DateTime } from "luxon"
import { Telegraf } from "telegraf"
import { MyTelegrafContext } from ".."
import Stat from "../entities/Stat"
import User from "../entities/User"
import logger from "../log"
import { BotCommandScope, registerCommand } from "./commandlist"

export default async function recordStat(
  bot: Telegraf<MyTelegrafContext>,
  type: string,
  recordCommand: string,
  undoCommand: string,
  infoCommand: string,
  addMsg = (count: number) => (Math.random() > 0.95 ? `Gast doe normaal, al ${count}` : `Lekker hoor, je ${count}e`),
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
    await ctx.reply(addMsg(count))
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
    const user = await ctx.db.findOne(User, { telegramId: ctx.message.from.id })
    const stats = await ctx.db.find(Stat, { user, type })
    if (user != null && stats.length > 0) {
      const firstStat = stats.reduce((first, curr) => (curr.date < first.date ? curr : first))
      const count = stats.length
      const weekStart = DateTime.now().set({ hour: 0, second: 0, minute: 0, weekday: 1 })
      const monthAgo = DateTime.now().minus({ month: 1 })
      const countWeek = stats.filter(stat => stat.date > weekStart).length
      const countMonth = stats.filter(stat => stat.date > monthAgo).length
      const dayAvg = Math.round(count / (DateTime.now().diff(firstStat.date).as("days") + 1))
      await ctx.reply(
        `Al ${count} keer sinds ${firstStat.date.toLocaleString(
          DateTime.DATE_MED,
        )}\n${countWeek} waren deze week\n${countMonth} waren de laatste maand\nGemiddeld ${dayAvg} per dag`,
      )
    } else {
      await ctx.reply("Ik ken jou helemaal niet, flikker op")
    }
  })
}
