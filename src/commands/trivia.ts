import { Telegraf } from "telegraf"
import { MyContext } from ".."

export default function triviaCommands(bot: Telegraf<MyContext>) {
  bot.hears("lul", ctx => {
    return ctx.reply("zuigen dan")
  })

  bot.command("nerd", ctx => {
    return ctx.replyWithHTML(`Oh jij coole nerd\n<pre language="json">${JSON.stringify(ctx.message, null, 2)}</pre>`)
  })

  bot.command("isdebaropen", ctx => {
    return ctx.reply("misschien")
  })

  bot.command("kut bot", ctx => {
    const random = Math.random()
    if (random > 0.7) {
      return ctx.reply(":(")
    } else if (random > 0.2) {
      return ctx.reply("Hou je bek man")
    } else {
      return ctx.reply("sorry")
    }
  })

  bot.command("raad", async ctx => {
    await ctx.reply("moeie imeelen")
  })

  bot.command("kopofmunt", async ctx => {
    if (Math.random() > 0.49) {
      await ctx.reply("kop")
    } else {
      await ctx.reply("munt")
    }
  })
}
