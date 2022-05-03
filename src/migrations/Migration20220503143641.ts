import { Migration } from "@mikro-orm/migrations"

export class Migration20220503143641 extends Migration {
  async up(): Promise<void> {
    this.addSql('create table "user" ("id" serial primary key, "telegram_id" varchar(100) not null);')

    this.addSql('create table "shit" ("id" serial primary key, "user_id" int not null);')

    this.addSql(
      'create table "chat_subscription" ("id" serial primary key, "telegram_chat_id" varchar(100) not null, "type" text check ("type" in (\'status\', \'birthday\')) not null);',
    )
    this.addSql(
      'alter table "chat_subscription" add constraint "chat_subscription_telegram_chat_id_type_unique" unique ("telegram_chat_id", "type");',
    )

    this.addSql(
      'alter table "shit" add constraint "shit_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade;',
    )
  }
}
