import { Collection, Entity, EntityRepositoryType, OneToMany, PrimaryKey, Property, Unique } from "@mikro-orm/core"
import { EntityRepository } from "@mikro-orm/postgresql"
import logger from "../log"
import Shit from "./Shit"

@Entity({ customRepository: () => CustomUserRepository })
export default class User {
  [EntityRepositoryType]?: CustomUserRepository
  constructor(telegramId: number) {
    this.telegramId = telegramId
  }

  @PrimaryKey({
    autoincrement: false,
    type: "bigint",
  })
  telegramId!: number

  @Property()
  @Unique()
  congressusId?: number

  @Property({
    type: "bigint",
  })
  @Unique()
  telegramPrivateChatId?: number

  @OneToMany(() => Shit, shit => shit.user)
  shits = new Collection<Shit>(this)
}

export class CustomUserRepository extends EntityRepository<User> {
  async findOrCreate(telegramId: number) {
    let user = await this.findOne({ telegramId })
    if (user == null) {
      user = new User(telegramId)
      await this.persist(user).flush()
      logger.info({ user }, "new user")
    }
    return user
  }
}
