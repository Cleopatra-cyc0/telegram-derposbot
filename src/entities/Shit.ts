import { Entity, ManyToOne, PrimaryKey } from "@mikro-orm/core"
import User from "./User"

@Entity()
export default class Shit {
  @PrimaryKey({
    autoincrement: true,
  })
  id!: number

  @ManyToOne()
  user!: User
}
