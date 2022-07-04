import { Entity, ManyToOne, PrimaryKey, Property } from "@mikro-orm/core"
import { DateTime } from "luxon"
import { LuxonDate } from "../util"
import User from "./User"

@Entity()
export default class Quote {
  @PrimaryKey({
    autoincrement: true,
  })
  id!: number

  @Property({
    type: "TEXT",
  })
  text!: string

  @ManyToOne({
    onDelete: "cascade",
    onUpdateIntegrity: "cascade",
  })
  author!: User

  @Property({ type: LuxonDate })
  date = DateTime.now()
}
