import { Entity, Enum, PrimaryKey, Property, Unique } from "@mikro-orm/core"

@Entity()
@Unique({ properties: ["telegramChatId", "type"] })
export default class ChatSubscription {
  constructor(telegramChatId: string, type: SubScriptionType) {
    this.telegramChatId = telegramChatId
    this.type = type
  }

  @PrimaryKey({ autoincrement: true })
  id!: number

  @Property({
    length: 100,
  })
  telegramChatId!: string

  @Enum(() => SubScriptionType)
  type!: SubScriptionType
}

export enum SubScriptionType {
  Status = "status",
  Birthday = "birthday",
}
