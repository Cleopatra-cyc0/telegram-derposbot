import { Entity, ManyToOne, PrimaryKey, Property } from "@mikro-orm/core"
import { DateTime } from "luxon"
import { LuxonDate } from "../util"
import User from "./User"

@Entity()
export default class Shit {
  constructor(user: User) {
    this.user = user
  }
  @PrimaryKey({
    autoincrement: true,
  })
  id!: number

  @Property({ type: LuxonDate })
  date = DateTime.now()

  @ManyToOne({
    onDelete: "cascade",
    onUpdateIntegrity: "cascade",
  })
  user!: User
}
