import { Telegraf } from "telegraf"
import {
  BotCommand,
  BotCommandScopeAllChatAdministrators,
  BotCommandScopeAllGroupChats,
  BotCommandScopeAllPrivateChats,
} from "telegraf/typings/core/types/typegram"
import { MyTelegrafContext } from ".."
import logger from "../log"
type SupportedScope =
  | BotCommandScopeAllChatAdministrators
  | BotCommandScopeAllGroupChats
  | BotCommandScopeAllPrivateChats

export const BotCommandScope: Record<string, SupportedScope> = {
  Private: { type: "all_private_chats" },
  Groups: { type: "all_group_chats" },
  Admins: { type: "all_chat_administrators" },
}

const commands: Record<SupportedScope["type"], BotCommand[]> = {
  all_chat_administrators: [],
  all_group_chats: [],
  all_private_chats: [],
}

export function registerCommand(command: string, description: string, scopes: SupportedScope | SupportedScope[]) {
  if (!Array.isArray(scopes)) {
    registerCommand(command, description, [scopes])
  } else if (scopes.length > 0) {
    for (const scope of scopes) {
      commands[scope.type].push({ command, description })
    }
  } else {
    for (const scope of Object.keys(commands)) {
      commands[scope as keyof typeof commands].push({ command, description })
    }
  }
}

export default async function commandList(bot: Telegraf<MyTelegrafContext>) {
  await Promise.all([
    ...Object.keys(commands).map(async scope =>
      bot.telegram.setMyCommands(commands[scope as keyof typeof commands], {
        scope: { type: scope as SupportedScope["type"] },
      }),
    ),
  ])
    .then(() => logger.trace("commands registered"))
    .catch(err => logger.error({ err }, "error registering commands"))
}
