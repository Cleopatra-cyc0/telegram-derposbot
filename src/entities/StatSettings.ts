import { Entity, EntityRepositoryType, ManyToOne, PrimaryKey, Property } from "@mikro-orm/core"
import { EntityRepository } from "@mikro-orm/postgresql"
import { DateTime } from "luxon"
import { LuxonDate } from "../util"
import { StatType } from "./Stat"
import User from "./User"

@Entity({ customRepository: () => CustomStatSettingsRepository })
export default class StatSettings {
  [EntityRepositoryType]!: CustomStatSettingsRepository

  @ManyToOne({ primary: true })
  user!: User

  @PrimaryKey()
  statType!: StatType

  @Property({ type: LuxonDate })
  currentPeriodStart?: DateTime

  @Property({ type: "bigint" })
  forwardChat?: number

  constructor(user: User, statType: StatType) {
    this.user = user
    this.statType = statType
  }
}

export class CustomStatSettingsRepository extends EntityRepository<StatSettings> {
  async setStatStartDate(statType: StatType, user: User, startDate: DateTime) {
    if (startDate.isValid) {
      let existingStatSettings = await this.findOne({ user, statType })
      if (existingStatSettings == null) {
        existingStatSettings = new StatSettings(user, statType)
      }
      existingStatSettings.currentPeriodStart = startDate
      await this.persist(existingStatSettings).flush()
    } else {
      throw new Error("invalid date")
    }
  }

  async setForwardChat(statType: StatType, user: User, chatId: number) {
    let existingStatSettings = await this.findOne({ user, statType })
    if (existingStatSettings == null) {
      existingStatSettings = new StatSettings(user, statType)
    }
    existingStatSettings.forwardChat = chatId
    await this.persist(existingStatSettings).flush()
  }
}
