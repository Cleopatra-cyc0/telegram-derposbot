import { Telegraf } from "telegraf"

export default function enableTrivia(bot: Telegraf) {
  bot.hears("lul", ctx => {
    ctx.reply("zuigen dan")
  })
}
