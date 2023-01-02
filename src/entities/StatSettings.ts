import { Entity, ManyToOne, PrimaryKey, Property } from "@mikro-orm/core"
import { DateTime } from "luxon"
import { LuxonDate } from "../util"
import { StatType } from "./Stat"
import User from "./User"

@Entity()
export class StatSettings {
  @ManyToOne({ primary: true })
  user!: User

  @PrimaryKey()
  statType!: StatType

  @Property({ type: LuxonDate })
  currentPeriodStart!: DateTime
}
