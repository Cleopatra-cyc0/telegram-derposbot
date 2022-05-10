import { Telegraf } from "telegraf"
import { MyTelegrafContext } from ".."
import { getMemberBirthDate } from "../model"
import { calculateDaysTillBirthDay, getRandomInRange } from "../util"

export default function triviaCommands(bot: Telegraf<MyTelegrafContext>) {
  bot.start(async ctx => {
    await ctx.reply("hoi")
  })
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

  bot.command("dock", async ctx => {
    if (ctx.chat.type === "private") {
      await ctx.replyWithPhoto("https://cumception.com/wp-content/upload/2020/06/cock_docki-5965.jpg")
    } else {
      try {
        await ctx.telegram.sendPhoto(
          ctx.message.from.id,
          "https://cumception.com/wp-content/upload/2020/06/cock_docki-5965.jpg",
        )
      } catch (error) {
        ctx.reply("Ik kan je prive niet bereiken, probeer even een privegesprek te starten")
      }
    }
  })
  const sprangId = parseInt(process.env.SPRANG_ID ?? "")
  if (!isNaN(sprangId)) {
    bot.command("sprang", async ctx => {
      const birthDate = await getMemberBirthDate(sprangId)
      const { days, age } = calculateDaysTillBirthDay(birthDate)
      ctx.reply(`Nog ${days} ${days === 1 ? "dag" : "dagen"} tot sprangs ${age}e verjaardag`)
    })
  }
  bot.command("waarbenje", async ctx => {
    ctx.replyWithLocation(getRandomInRange(-180, 180), getRandomInRange(-180, 180))
  })
}
