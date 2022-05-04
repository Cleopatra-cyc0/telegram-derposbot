import { Telegraf } from "telegraf"
import { MyContext } from "."

export default function triviaCommands(bot: Telegraf<MyContext>) {
  bot.hears("lul", ctx => {
    ctx.reply("zuigen dan")
  })

  bot.command("nerd", ctx => {
    ctx.replyWithHTML(`Oh jij coole nerd\n<pre language="json">${JSON.stringify(ctx.message, null, 2)}</pre>`)
  })

  bot.command("isdebaropen", ctx => {
    ctx.reply("misschien")
  })
}
