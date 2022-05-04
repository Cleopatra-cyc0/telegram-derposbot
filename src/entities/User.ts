import { Collection, Entity, OneToMany, PrimaryKey, Property } from "@mikro-orm/core"
import Shit from "./Shit"

@Entity()
export default class User {
  constructor(telegramId: string) {
    this.telegramId = telegramId
  }

  @PrimaryKey({
    autoincrement: true,
  })
  id!: number

  @Property({
    length: 100,
  })
  telegramId!: string

  @OneToMany(() => Shit, shit => shit.user)
  shits = new Collection<Shit>(this)
}
