import { Collection, Entity, EntityRepositoryType, OneToMany, PrimaryKey, Property, Unique } from "@mikro-orm/core"
import { EntityRepository } from "@mikro-orm/postgresql"
import logger from "../log"
import Stat from "./Stat"

@Entity({ customRepository: () => CustomUserRepository })
export default class User {
  [EntityRepositoryType]?: CustomUserRepository
  constructor(telegramId: number) {
    this.telegramId = telegramId
  }

  @PrimaryKey({
    autoincrement: true,
  })
  id!: number

  @Property({
    type: "bigint",
  })
  telegramId?: number

  @Property()
  @Unique()
  congressusId?: number

  @Property({
    type: "bigint",
  })
  @Unique()
  telegramPrivateChatId?: number

  @Property({ default: false })
  hasDokNotifications = false

  @OneToMany(() => Stat, shit => shit.user)
  stats = new Collection<Stat>(this)
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
