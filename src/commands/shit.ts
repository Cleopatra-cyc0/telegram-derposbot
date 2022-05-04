import { DateTime } from "luxon"
import { Telegraf } from "telegraf"
import { MyContext } from ".."
import Shit from "../entities/Shit"
import User from "../entities/User"
import logger from "../log"

export default function shitCommands(bot: Telegraf<MyContext>) {
  bot.command("poep", async ctx => {
    let user = await ctx.db.findOne(User, { telegramId: ctx.message.from.id.toString() })
    if (user == null) {
      user = new User(ctx.message.from.id.toString())
      await ctx.db.persist(user)
      logger.info({ user }, "new user")
    }
    const shit = new Shit(user)
    await ctx.db.persist(shit).flush()
    logger.trace({ user }, "new shit")
    const count = await ctx.db.count(Shit, { user })
    if (Math.random() > 0.9) {
      ctx.reply(`Gast doe normaal, al ${count}`)
    } else {
      ctx.reply(`Lekker hoor, je ${count}e`)
    }
  })

  bot.command("oopsie", async ctx => {
    const user = await ctx.db.findOne(User, { telegramId: ctx.message.from.id.toString() }, { populate: ["shits"] })
    if (user != null) {
      const lastShit = user.shits.getItems().reduce((last, curr) => (curr.date > last.date ? curr : last))
      ctx.db.remove(lastShit)
      ctx.reply("Oke die is weg")
    } else {
      ctx.reply("Ik ken jou helemaal niet, flikker op")
    }
  })

  bot.command("poepstats", async ctx => {
    const user = await ctx.db.findOne(User, { telegramId: ctx.message.from.id.toString() }, { populate: ["shits"] })
    if (user != null && user.shits.length > 0) {
      const firstPoop = user.shits.getItems().reduce((first, curr) => (curr.date < first.date ? curr : first))
      const count = user.shits.length
      const todayStart = DateTime.now().set({ hour: 0, second: 0, minute: 0 })
      const countToday = user.shits.getItems().filter(shit => shit.date > todayStart).length
      ctx.reply(
        `Je hebt al ${count} keer gepoept sinds ${firstPoop.date.toLocaleString(
          DateTime.DATE_MED,
        )}\n${countToday} waren vandaag`,
      )
    } else {
      ctx.reply("Ik ken jou helemaal niet, flikker op")
    }
  })
}
