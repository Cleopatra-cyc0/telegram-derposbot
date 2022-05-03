import { Telegraf } from "telegraf"
import { MyContext } from "."

export default function enableTrivia(bot: Telegraf<MyContext>) {
  bot.hears("lul", ctx => {
    ctx.reply("zuigen dan")
  })
}
