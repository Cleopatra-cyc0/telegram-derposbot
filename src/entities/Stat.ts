import { Entity, ManyToOne, PrimaryKey, Property } from "@mikro-orm/core"
import { DateTime } from "luxon"
import { LuxonDate } from "../util.js"
import User from "./User.js"

@Entity()
export default class Stat {
  constructor(user: User, type: string) {
    this.user = user
    this.type = type
  }
  @PrimaryKey({
    autoincrement: true,
  })
  id!: number

  @Property()
  type!: string

  @Property({ type: LuxonDate })
  date = DateTime.now()

  @ManyToOne({
    onDelete: "cascade",
    onUpdateIntegrity: "cascade",
  })
  user!: User
}
