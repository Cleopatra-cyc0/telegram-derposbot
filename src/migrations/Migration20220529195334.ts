import { Migration } from '@mikro-orm/migrations';

export class Migration20220529195334 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table "stat" ("id" serial primary key, "type" varchar(255) not null, "date" varchar(30) not null, "user_telegram_id" bigint not null);');

    this.addSql('alter table "stat" add constraint "stat_user_telegram_id_foreign" foreign key ("user_telegram_id") references "user" ("telegram_id") on update cascade on delete cascade;');

    this.addSql('insert into "stat" ("type", "date", "user_telegram_id") select \'shit\', "date", "user_telegram_id" from "shit";');

    this.addSql('drop table if exists "shit" cascade;');
  }

  async down(): Promise<void> {
    this.addSql('create table "shit" ("id" serial primary key, "date" varchar(30) not null, "user_telegram_id" bigint not null);');

    this.addSql('alter table "shit" add constraint "shit_user_telegram_id_foreign" foreign key ("user_telegram_id") references "user" ("telegram_id") on update cascade on delete cascade;');

    this.addSql('drop table if exists "stat" cascade;');
  }

}
