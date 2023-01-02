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
  currentPeriodStart!: DateTime

  constructor(user: User, statType: StatType, currentPeriodStart: DateTime) {
    this.user = user
    this.statType = statType
    this.currentPeriodStart = currentPeriodStart
  }
}

export class CustomStatSettingsRepository extends EntityRepository<StatSettings> {
  async setStatStartDate(statType: StatType, user: User, startDate: DateTime) {
    if (startDate.isValid) {
      let existingStatSettings = await this.findOne({ user, statType })
      if (existingStatSettings == null) {
        existingStatSettings = new StatSettings(user, statType, startDate)
        await this.persist(existingStatSettings).flush()
      } else {
        existingStatSettings.currentPeriodStart = startDate
        await this.persist(existingStatSettings).flush()
      }
    } else {
      throw new Error("invalid date")
    }
  }
}
