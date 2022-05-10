import { Telegraf } from "telegraf"
import { MyTelegrafContext } from ".."
import { getMemberBirthDate } from "../model"
import { calculateDaysTillBirthDay } from "../util"

export default function triviaCommands(bot: Telegraf<MyTelegrafContext>) {
  bot.hears("lul", ctx => {
    return ctx.reply("zuigen dan")
  })

  bot.command("nerd", ctx => {
    return ctx.replyWithHTML(`Oh jij coole nerd\n<pre language="json">${JSON.stringify(ctx.message, null, 2)}</pre>`)
  })

  bot.command("isdebaropen", ctx => {
    return ctx.reply("misschien")
  })

  bot.command("kutbot", ctx => {
    const random = Math.random()
    if (random > 0.7) {
      return ctx.reply(":(")
    } else if (random > 0.2) {
      return ctx.reply("Hou je bek man")
    } else {
      return ctx.reply("sorry")
    }
  })

  bot.command("kopofmunt", async ctx => {
    if (Math.random() >= 0.5) {
      await ctx.reply("kop")
    } else {
      await ctx.reply("munt")
    }
  })
  if (process.env.SPRANG_ID != null && process.env.SPRANG_ID != "") {
    bot.command("sprang", async ctx => {
      const birthDate = await getMemberBirthDate(process.env.SPRANG_ID as string)
      const { days, age } = calculateDaysTillBirthDay(birthDate)
      ctx.reply(`Nog ${days} ${days === 1 ? "dag" : "dagen"} tot sprangs ${age}e verjaardag`)
    })
  }
}
