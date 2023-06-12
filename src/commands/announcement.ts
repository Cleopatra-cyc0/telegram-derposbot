import { EntityManager } from "@mikro-orm/postgresql"
import { DateTime } from "luxon"
import { Telegraf, Telegram } from "telegraf"
import TelegrafStatelessQuestion from "telegraf-stateless-question/dist/source"
import { InlineKeyboardButton, Message } from "telegraf/typings/core/types/typegram"
import { MyTelegrafContext } from ".."
import { DeleteMessageTask, ForwardMessageTask, MessageTask, Task } from "../entities/Task"
import logger from "../log"
import { getRandomInRange, isMemberOfEnum } from "../util"
import { BotCommandScope, registerCommand } from "./commandlist"

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
  Approve,
  Decline,
  Schedule,

  ScheduleAnswer,

  ScheduleOptionCancel,

  ScheduleCancel,

  ScheduleCustomTime,
  ScheduleCustomTimeCancel,
}

type CallbackDataArgs =
  | {
      type:
        | AnnouncementReply.Approve
        | AnnouncementReply.Schedule
        | AnnouncementReply.Decline
        | AnnouncementReply.ScheduleOptionCancel
        | AnnouncementReply.ScheduleCustomTime
        | AnnouncementReply.ScheduleCustomTimeCancel
      announcementMessageId: MessageIdentifier
    }
  | {
      type: AnnouncementReply.ScheduleAnswer
      announcementMessageId: MessageIdentifier
      time: number
    }
  | {
      type: AnnouncementReply.ScheduleCancel
      announcementMessageId: MessageIdentifier
      sendAnnouncementTaskId: number
      deleteStatusMessageTaskId: number
    }

const encodeCallbackData = (data: CallbackDataArgs) => {
  const encodeMessageId = (id: MessageIdentifier) => `${id.chatId}-${id.messageId}`
  if (
    data.type === AnnouncementReply.Approve ||
    data.type === AnnouncementReply.Schedule ||
    data.type === AnnouncementReply.Decline ||
    data.type === AnnouncementReply.ScheduleOptionCancel ||
    data.type === AnnouncementReply.ScheduleCustomTime ||
    data.type === AnnouncementReply.ScheduleCustomTimeCancel
  ) {
    return `APR-${data.type.toString()}${encodeMessageId(data.announcementMessageId)}`
  } else if (data.type === AnnouncementReply.ScheduleAnswer) {
    return `APR-${data.type.toString()}${encodeMessageId(data.announcementMessageId)}-${data.time}`
  } else if (data.type === AnnouncementReply.ScheduleCancel) {
    return `APR-${data.type.toString()}${encodeMessageId(data.announcementMessageId)}-${data.sendAnnouncementTaskId}-${
      data.deleteStatusMessageTaskId
    }`
  } else {
    throw new Error("Invalid AnnouncementReply type")
  }
}

const decodeCallbackData = (data: string): CallbackDataArgs => {
  const parseMessageId = (parts: string[]): MessageIdentifier => {
    const chatId = parseInt(parts[0])
    const messageId = parseInt(parts[1])
    if (isNaN(chatId) || isNaN(messageId)) {
      throw new Error("Invalid callback data")
    }
    return { chatId, messageId }
  }
  if (!data.startsWith("APR-")) {
    throw new Error("Invalid callback data")
  }
  const typeNumber = parseInt(data.slice(4, 5))
  if (isNaN(typeNumber)) {
    throw new Error("Invalid callback data")
  }
  const type = typeNumber as AnnouncementReply
  if (!isMemberOfEnum(type, AnnouncementReply)) {
    throw new Error("Invalid callback data")
  }
  const parts = data.slice(5).split("-")
  if (
    type === AnnouncementReply.Approve ||
    type === AnnouncementReply.Schedule ||
    type === AnnouncementReply.Decline ||
    type === AnnouncementReply.ScheduleOptionCancel ||
    type === AnnouncementReply.ScheduleCustomTime ||
    type === AnnouncementReply.ScheduleCustomTimeCancel
  ) {
    return {
      type,
      announcementMessageId: parseMessageId(parts),
    }
  } else if (type === AnnouncementReply.ScheduleAnswer) {
    const time = parseInt(parts[2])
    if (isNaN(time)) {
      throw new Error("Invalid callback data")
    }
    return {
      type,
      announcementMessageId: parseMessageId(parts),
      time,
    }
  } else if (type === AnnouncementReply.ScheduleCancel) {
    const sendAnnouncementTaskId = parseInt(parts[2])
    const deleteStatusMessageTaskId = parseInt(parts[3])
    if (isNaN(sendAnnouncementTaskId) || isNaN(deleteStatusMessageTaskId)) {
      throw new Error("Invalid callback data")
    }
    return {
      type,
      announcementMessageId: parseMessageId(parts),
      sendAnnouncementTaskId,
      deleteStatusMessageTaskId,
    }
  } else {
    throw new Error("Invalid AnnouncementReply type")
  }
}
const constructInitialInlineKeyboard = (messageId: MessageIdentifier) => [
  [
    {
      text: "Ja",
      callback_data: encodeCallbackData({
        type: AnnouncementReply.Approve,
        announcementMessageId: messageId,
      }),
    },
    {
      text: "Later",
      callback_data: encodeCallbackData({
        type: AnnouncementReply.Schedule,
        announcementMessageId: messageId,
      }),
    },
  ],
  [
    {
      text: "Nee",
      callback_data: encodeCallbackData({
        type: AnnouncementReply.Decline,
        announcementMessageId: messageId,
      }),
    },
  ],
]

const constructScheduleInlineKeyboard = (announcementMessageId: MessageIdentifier, now: DateTime) => {
  const optionRows: InlineKeyboardButton[][] = [
    [
      {
        text: "Toch niet",
        callback_data: encodeCallbackData({
          type: AnnouncementReply.ScheduleOptionCancel,
          announcementMessageId: announcementMessageId,
        }),
      },
    ],
    ...[1, 2, 4, 8, 24, 48]
      .map(h => now.plus({ hours: h }))
      .map(t => ({
        text: t.toLocaleString(DateTime.DATETIME_SHORT),
        callback_data: encodeCallbackData({
          type: AnnouncementReply.ScheduleAnswer,
          announcementMessageId: announcementMessageId,
          time: t.toMillis(),
        }),
      }))
      .reduce<InlineKeyboardButton[][]>(
        (rows, opt) => {
          const precedingRows = rows.slice(0, rows.length - 1)
          const lastRow = rows[rows.length - 1]
          if (lastRow.length < 3) {
            return [...precedingRows, [...lastRow, opt]]
          } else {
            return [...rows, [opt]]
          }
        },
        [[]],
      ),
    [
      {
        text: "Vul datum in",
        callback_data: encodeCallbackData({
          type: AnnouncementReply.ScheduleCustomTime,

          announcementMessageId: announcementMessageId,
        }),
      },
    ],
  ]
  return optionRows
}

const constructCustomScheduleInlineKeyboard = (messageId: MessageIdentifier) => [
  [
    {
      text: "Toch niet",
      callback_data: encodeCallbackData({
        type: AnnouncementReply.ScheduleCustomTimeCancel,
        announcementMessageId: messageId,
      }),
    },
  ],
]

const announcementQuestion = new TelegrafStatelessQuestion<MyTelegrafContext>("Stuur nu je mededeling", async ctx => {
  if (ctx.chat != null) {
    const messageText = (ctx.message as Message & { text: string }).text
    logger.trace({ from: ctx.message.from.id, text: messageText }, `Got new announcement request`)
    const forwardedMessage = await ctx.forwardMessage(announcementApprovalChatId)
    await ctx.telegram.sendMessage(announcementApprovalChatId, "Goedkeuren?", {
      reply_to_message_id: forwardedMessage.message_id,
      reply_markup: {
        inline_keyboard: constructInitialInlineKeyboard({
          chatId: ctx.message.chat.id,
          messageId: ctx.message.message_id,
        }),
      },
    })
    await ctx.reply("Joe, ligt klaar voor goedkeuring", { reply_markup: { remove_keyboard: true } })
  } else {
    logger.error({ message: ctx.message }, "Received message without chat attached")
    await ctx.reply("Er gaat nu wel iets raars mis hoor, sorry")
  }
})

type AnnouncementCustomScheduleQuestionAdditionalState = {
  announcementMessageId: MessageIdentifier
  statusMessageId: MessageIdentifier
}

const announcementCustomSchedulequestion = new TelegrafStatelessQuestion<MyTelegrafContext>(
  "Okehoelaat",
  async (ctx, additionalState: string) => {
    logger.debug("Custom schedule answer!")
    const messageText = (ctx.message as Message & { text: string }).text
    const date = DateTime.fromISO(messageText)
    const additional = JSON.parse(additionalState) as AnnouncementCustomScheduleQuestionAdditionalState
    if (!date.isValid || date < DateTime.now()) {
      await ctx.reply(!date.isValid ? "Kan de datum niet begrijpen zo hoor" : "Kan geen datum in het verleden zijn")
      await ctx.telegram.editMessageReplyMarkup(
        additional.statusMessageId.chatId,
        additional.statusMessageId.messageId,
        undefined,
        {
          inline_keyboard: constructInitialInlineKeyboard(additional.announcementMessageId),
        },
      )
    } else {
      await scheduleSend(ctx.telegram, ctx.db, additional.announcementMessageId, date, additional.statusMessageId)
    }
  },
)

type MessageIdentifier = {
  chatId: number
  messageId: number
}

async function scheduleSend(
  telegram: Telegram,
  db: EntityManager,
  announcementMessageId: MessageIdentifier,
  sendDate: DateTime,
  statusMessageId: MessageIdentifier,
) {
  const scheduledAnnouncementTask = new ForwardMessageTask(
    sendDate,
    announcementMessageId.chatId,
    announcementMessageId.messageId,
    announcementChatId,
    true,
  )
  const deleteStatusMessageTask = new DeleteMessageTask(sendDate, statusMessageId.chatId, statusMessageId.messageId)
  await db.persist([scheduledAnnouncementTask, deleteStatusMessageTask]).flush()

  await telegram.editMessageText(
    statusMessageId.chatId,
    statusMessageId.messageId,
    undefined,
    `Gaat op ${sendDate.toLocaleString(DateTime.DATETIME_FULL)}`,
  )
  await telegram.editMessageReplyMarkup(statusMessageId.chatId, statusMessageId.messageId, undefined, {
    inline_keyboard: [
      [
        {
          text: "Annuleer",
          callback_data: encodeCallbackData({
            type: AnnouncementReply.ScheduleCancel,

            announcementMessageId: announcementMessageId,
            sendAnnouncementTaskId: scheduledAnnouncementTask.id,
            deleteStatusMessageTaskId: deleteStatusMessageTask.id,
          }),
        },
      ],
    ],
  })
  await telegram.sendMessage(
    announcementMessageId.chatId,
    `Mededeling gaat op ${sendDate.toLocaleString(DateTime.DATETIME_FULL)}`,
  )
}

export default function announcementCommands(bot: Telegraf<MyTelegrafContext>) {
  bot.use(announcementQuestion.middleware())
  bot.use(announcementCustomSchedulequestion.middleware())
  registerCommand("mededeling", "Stuur een mededeling naar bestuur", BotCommandScope.Private)
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
      ctx.callbackQuery.data.startsWith("APR-") &&
      !callbacksProcessing.has(ctx.callbackQuery.data)
    ) {
      callbacksProcessing.add(ctx.callbackQuery.data)
      try {
        const callbackData = decodeCallbackData(ctx.callbackQuery.data)
        if (callbackData.type === AnnouncementReply.Approve) {
          await ctx.deleteMessage()
          await ctx.telegram.copyMessage(
            announcementChatId,
            callbackData.announcementMessageId.chatId,
            callbackData.announcementMessageId.messageId,
          )
          await ctx.telegram.sendMessage(
            callbackData.announcementMessageId.chatId,
            "Woweee, ze hebben hem gewoon direct goedgekeurd en hij is gedeeld!",
          )
        } else if (callbackData.type === AnnouncementReply.Decline) {
          await ctx.editMessageText("Afgekeurd")
          await ctx.telegram.sendMessage(
            callbackData.announcementMessageId.chatId,
            "Helaas, je mededeling is afgekeurd",
          )
        } else if (callbackData.type === AnnouncementReply.Schedule) {
          await ctx.editMessageReplyMarkup({
            inline_keyboard: constructScheduleInlineKeyboard(callbackData.announcementMessageId, DateTime.now()),
          })
        } else if (callbackData.type === AnnouncementReply.ScheduleAnswer) {
          const dateToSend = DateTime.fromMillis(callbackData.time)
          if (!ctx.chat || !ctx.callbackQuery.message) {
            logger.error("Weird state in callback query, no chat or message attached")
            await ctx.reply("It's gone wrong...")
            return
          }
          const statusMessageId: MessageIdentifier = {
            chatId: ctx.chat.id,
            messageId: ctx.callbackQuery.message.message_id,
          }
          await scheduleSend(ctx.telegram, ctx.db, callbackData.announcementMessageId, dateToSend, statusMessageId)
        } else if (callbackData.type === AnnouncementReply.ScheduleCustomTime) {
          if (!ctx.chat || !ctx.callbackQuery.message) {
            logger.error("Weird state in callback query, no chat or message attached")
            await ctx.reply("It's gone wrong...")
            return
          }
          const additionalState: AnnouncementCustomScheduleQuestionAdditionalState = {
            announcementMessageId: callbackData.announcementMessageId,
            statusMessageId: {
              chatId: ctx.chat.id,
              messageId: ctx.callbackQuery.message.message_id,
            },
          }
          await ctx.editMessageReplyMarkup({
            inline_keyboard: constructCustomScheduleInlineKeyboard(callbackData.announcementMessageId),
          })
          await announcementCustomSchedulequestion.replyWithMarkdown(
            ctx,
            "Oke, hoelaat? (ISO 8601 standaard)",
            JSON.stringify(additionalState),
          )
        } else if (callbackData.type === AnnouncementReply.ScheduleOptionCancel) {
          await ctx.editMessageReplyMarkup({
            inline_keyboard: constructInitialInlineKeyboard(callbackData.announcementMessageId),
          })
        } else if (callbackData.type === AnnouncementReply.ScheduleCancel) {
          const task = await ctx.db.find(Task, {
            id: { $in: [callbackData.deleteStatusMessageTaskId, callbackData.sendAnnouncementTaskId] },
          })
          if (task.length !== 2) {
            throw new Error("Expected 2 tasks to be found")
          }
          ctx.db.remove(task)

          await ctx.editMessageText("Later versturen geannuleerd. Wat wil je nou?")
          await ctx.editMessageReplyMarkup({
            inline_keyboard: constructInitialInlineKeyboard(callbackData.announcementMessageId),
          })
          await ctx.telegram.sendMessage(callbackData.announcementMessageId.chatId, "Later versturen geannuleerd")
        } else if (callbackData.type === AnnouncementReply.ScheduleCustomTimeCancel) {
          await ctx.editMessageReplyMarkup({
            inline_keyboard: constructScheduleInlineKeyboard(callbackData.announcementMessageId, DateTime.now()),
          })
        }
      } catch (e) {
        logger.error(
          { callbackQuery: ctx.callbackQuery, error: JSON.stringify(e, Object.getOwnPropertyNames(e)) },
          "invalid announcement callback data",
        )
      } finally {
        callbacksProcessing.delete(ctx.callbackQuery.data)
      }
    } else {
      await next()
    }
  })
}
