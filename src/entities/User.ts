import { Collection, Entity, EntityRepositoryType, OneToMany, PrimaryKey, Property, Unique } from "@mikro-orm/core"
import { EntityRepository } from "@mikro-orm/postgresql"
import logger from "../log"
import Quote from "./Quote"
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
  telegramUsername?: string

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

  @OneToMany(() => Quote, quote => quote.author)
  quotes = new Collection<Quote>(this)
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

  /**
   * Merge a user with congressusId into a user with telegramId
   * @param fromId id of the user to merge and delete
   * @param intoId id of the user to merge into
   */
  async mergeUsers(fromId: number, intoId: number) {
    const fromUser = await this.findOne({ id: fromId }, { populate: ["stats", "quotes"] })
    const intoUser = await this.findOne({ id: intoId })
    if (fromUser == null) {
      throw new Error("from user not found")
    }
    if (intoUser == null) {
      throw new Error("into user not found")
    }
    for (const stat of fromUser.stats) {
      stat.user = intoUser
    }
    intoUser.stats.add(...fromUser.stats)
    for (const quote of fromUser.quotes) {
      quote.author = intoUser
    }
    intoUser.quotes.add(...fromUser.quotes)
    await this.persist(intoUser).flush()
    await this.remove(fromUser).flush()
    intoUser.congressusId = fromId // Do this last so we won't violate unique constraint
    await this.persist(intoUser).flush()
  }
}
