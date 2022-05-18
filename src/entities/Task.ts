import { Entity, PrimaryKey, Property } from "@mikro-orm/core"
import { DateTime } from "luxon"
import { Telegram } from "telegraf"
import { LuxonDate } from "../util"

@Entity({
  discriminatorColumn: "type",
  abstract: true,
})
export abstract class Task {
  @PrimaryKey()
  id!: number

  @Property({ type: LuxonDate })
  creationDate: DateTime = DateTime.now()

  /**
   * Indicates the moment this task should be run
   */
  @Property({ type: LuxonDate })
  runDate!: DateTime

  @Property()
  done = false

  constructor(runDate: DateTime) {
    if (runDate < this.creationDate) {
      throw new Error("Cannot create task in the past")
    }
    this.runDate = runDate
  }

  /**
   * Whether the task should be run at this moment
   * @param now what time is it now
   * @returns a boolean indicating whether the task should be run
   */
  isEligibeToRun(now: DateTime) {
    return !this.done && now > this.runDate
  }

  abstract run(telegram: Telegram): Promise<void>
}

@Entity({ discriminatorValue: "message" })
export class MessageTask extends Task {
  @Property({
    type: "bigint",
  })
  chatId: number

  @Property()
  message!: string

  constructor(runDate: DateTime, chatId: number, message: string) {
    super(runDate)
    this.chatId = chatId
    this.message = message
  }

  override async run(telegram: Telegram) {
    await telegram.sendMessage(this.chatId, this.message)
  }
}

@Entity({ discriminatorValue: "forwardMessage" })
export class ForwardMessageTask extends Task {
  @Property({ type: "bigint" })
  fromChatId!: number

  @Property({ type: "bigint" })
  fromMessageId!: number

  @Property({ type: "bigint" })
  toChatId!: number

  @Property()
  useCopy!: boolean

  constructor(runTime: DateTime, fromChat: number, fromMessage: number, toChat: number, useCopy = false) {
    super(runTime)
    this.fromChatId = fromChat
    this.fromMessageId = fromMessage
    this.toChatId = toChat
    this.useCopy = useCopy
  }

  async run(telegram: Telegram) {
    if (this.useCopy) {
      await telegram.copyMessage(this.toChatId, this.fromChatId, this.fromMessageId)
    } else {
      await telegram.forwardMessage(this.toChatId, this.fromChatId, this.fromMessageId)
    }
  }
}
