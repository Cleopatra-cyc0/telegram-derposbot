import { Telegraf } from "telegraf"
import TelegrafStatelessQuestion from "telegraf-stateless-question/dist/source"
import { MyTelegrafContext } from ".."
import logger from "../log"
import { stringInEnum } from "../util"

const announcementApprovalChatId = parseInt(process.env.ANNOUNCEMENT_APPROVAL_CHAT_ID ?? "")
const announcementChatId = parseInt(process.env.ANNOUNCEMENT_CHAT_ID ?? "")

if (isNaN(announcementApprovalChatId)) {
  logger.fatal("Invalid announcement approval chat id provided, exiting")
  process.exit(6)
}
if (isNaN(announcementChatId)) {
  logger.fatal("Invalid announcement chat id provided, exiting")
  process.exit(7)
}

enum AnnouncementReply {
  Approve = "approve",
  Decline = "decline",

  ConfirmReceived = "confirm_received",
}

const constructInlineKeyboard = (messageId: number, chatId?: number, includeConrifmRead = true) => [
  [
    {
      text: "Ja",
      callback_data: `APR-${JSON.stringify([AnnouncementReply.Approve, messageId, chatId])}`,
    },
    {
      text: "Bevestig ontvangst",
      callback_data: `APR-${JSON.stringify([AnnouncementReply.ConfirmReceived, messageId, chatId])}`,
    },
    {
      text: "Nee",
      callback_data: `APR-${JSON.stringify([AnnouncementReply.Decline, messageId, chatId])}`,
    },
  ].filter(a => a.text !== "Bevestig ontvangst" || includeConrifmRead),
]

const announcementQuestion = new TelegrafStatelessQuestion<MyTelegrafContext>("Stuur nu je mededeling", async ctx => {
  const forwardedMessage = await ctx.forwardMessage(announcementApprovalChatId)
  await ctx.telegram.sendMessage(announcementApprovalChatId, "Goedkeuren?", {
    reply_to_message_id: forwardedMessage.message_id,
    reply_markup: {
      inline_keyboard: constructInlineKeyboard(forwardedMessage.message_id, ctx.chat?.id),
    },
  })
  await ctx.reply("Joe, ligt klaar voor goedkeuring", { reply_markup: { remove_keyboard: true } })
})

export default function announcementCommands(bot: Telegraf<MyTelegrafContext>) {
  bot.use(announcementQuestion.middleware())
  bot.command("mededeling", async ctx => {
    if (ctx.chat.type === "private") {
      await announcementQuestion.replyWithMarkdown(ctx, "Stuur nu je mededeling")
    } else {
      ctx.reply(`werkt alleen prive: https://t.me/${ctx.botInfo?.username}`)
    }
  })

  const callbacksProcessing = new Set<string>()
  bot.on("callback_query", async (ctx, next) => {
    if (
      ctx.callbackQuery.data != null &&
      ctx.callbackQuery.data.startsWith("APR") &&
      !callbacksProcessing.has(ctx.callbackQuery.data)
    ) {
      callbacksProcessing.add(ctx.callbackQuery.data)
      const callbackData = JSON.parse(ctx.callbackQuery.data.slice(-4))
      const [action, messageId, chatId] = callbackData
      if (stringInEnum(action, AnnouncementReply)) {
        if (action !== AnnouncementReply.ConfirmReceived) {
          await ctx.deleteMessage()
          if (action === AnnouncementReply.Approve) {
            await ctx.telegram.copyMessage(announcementChatId, announcementApprovalChatId, messageId)
          } else if (action === AnnouncementReply.Decline) {
            await ctx.deleteMessage(messageId)
          }
        } else {
          await ctx.editMessageReplyMarkup({
            inline_keyboard: constructInlineKeyboard(messageId, chatId, false),
          })
          await ctx.telegram.sendMessage(chatId, "Bestuur heef je bericht gezien en is er mee bezig")
        }
      } else {
        logger.error({ callbackQuery: ctx.callbackQuery }, "invalid announcement callback data")
      }
      callbacksProcessing.delete(ctx.callbackQuery.data)
    } else {
      await next()
    }
  })
}
