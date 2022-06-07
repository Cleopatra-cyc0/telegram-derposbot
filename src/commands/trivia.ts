import sleep from "sleep-promise"
import { Telegraf } from "telegraf"
import { MyTelegrafContext } from "../index.js"
import { getMemberBirthDate } from "../model.js"
import { calculateDaysTillBirthDay, getRandomLocation } from "../util.js"

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

  bot.command("goodbot", ctx => {
    return ctx.replyWithPhoto("https://ppcprotect.com/static/d634452a7d2ae979b9fcd9a04d3bf6eb/good-bots.jpg")
  })

  bot.command("kopofmunt", async ctx => {
    if (Math.random() >= 0.5) {
      await ctx.reply("kop")
    } else {
      await ctx.reply("munt")
    }
  })

  bot.command("dock", async ctx => {
    await ctx.reply("Dus jij wil dock zien?")
    await sleep(1000)
    if (ctx.chat.type === "private") {
      await ctx.replyWithPhoto("https://cumception.com/wp-content/upload/2020/06/cock_docki-5965.jpg")
    } else {
      try {
        await ctx.telegram.sendPhoto(
          ctx.message.from.id,
          "https://cumception.com/wp-content/upload/2020/06/cock_docki-5965.jpg",
        )
      } catch (error) {
        await ctx.reply("Ik kan je prive niet bereiken, probeer even een privegesprek te starten")
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
    const location = getRandomLocation()
    await ctx.replyWithLocation(location.lat, location.long, {
      horizontal_accuracy: 1500,
    })
  })
}
