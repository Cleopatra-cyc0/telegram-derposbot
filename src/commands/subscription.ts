import { Telegraf } from "telegraf"
import { MyContext } from ".."
import logger from "../log"
import ChatSubscription, { SubScriptionType } from "../entities/ChatSubscription"
import { enumKeys } from "../util"

export default function subscriptionCommands(bot: Telegraf<MyContext>) {
  bot.start(async ctx => {
    const typeRaw = ctx.message.text.split(" ")[1]?.toLowerCase()
    let type: SubScriptionType | null = null
    for (const key of enumKeys(SubScriptionType)) {
      if (typeRaw === SubScriptionType[key]) {
        type = typeRaw
        break
      }
    }
    type = type ?? SubScriptionType.Birthday
    if (
      ctx.chat.type === "private" ||
      ["administrator", "creator"].includes((await ctx.getChatMember(ctx.from.id)).status)
    ) {
      if ((await ctx.db.count(ChatSubscription, { telegramChatId: ctx.chat.id.toString(), type })) === 0) {
        const sub = new ChatSubscription(ctx.chat.id.toString(), type)
        ctx.db.persist(sub)
        ctx.reply(`Ja prima${type === SubScriptionType.Birthday ? ", je hoort het om 00:05" : ""}`)
        logger.info(
          {
            chatId: ctx.chat.id,
            type,
            chatName: ctx.chat.type === "private" ? `${ctx.from.first_name} ${ctx.from.last_name}` : ctx.chat.title,
          },
          "register subscription",
        )
      } else {
        ctx.reply("Was al")
      }
    } else {
      ctx.reply("mag niet")
    }
  })
  bot.command("cancel", async ctx => {
    const typeRaw = ctx.message.text.split(" ")[1]?.toLowerCase()
    let type: SubScriptionType | null = null
    for (const key of enumKeys(SubScriptionType)) {
      if (typeRaw === SubScriptionType[key]) {
        type = typeRaw
        break
      }
    }
    type = type ?? SubScriptionType.Birthday
    if (
      ctx.chat.type === "private" ||
      ["administrator", "creator"].includes((await ctx.getChatMember(ctx.from.id)).status)
    ) {
      const sub = await ctx.db.findOne(ChatSubscription, { type, telegramChatId: ctx.chat.id.toString() })
      if (sub != null) {
        ctx.db.remove(sub)
        logger.info(
          {
            chatId: ctx.chat.id,
            type,
            chatName: ctx.chat.type === "private" ? `${ctx.from.first_name} ${ctx.from.last_name}` : ctx.chat.title,
          },
          "remove subscription",
        )
        ctx.reply("joe")
      } else {
        ctx.reply("Was al niet joh")
      }
    } else {
      ctx.reply("mag niet")
    }
  })
}