import { Telegraf } from "telegraf"
import { MyTelegrafContext } from ".."

const commands = new Map<string, { command: string; description: string }>()

export function registerCommand(command: string, description: string) {
  commands.set(command, { command, description })
}

export default function commandListCommands(bot: Telegraf<MyTelegrafContext>) {
  registerCommand("commandlist", "welke commands zijn er?")
  bot.command("commandlist", async ctx => {
    await ctx.reply(
      `Commands:\n\t${Array.from(commands.values())
        .map(({ command, description }) => `/${command}: ${description}`)
        .join("\n\t")}`,
    )
  })
}
