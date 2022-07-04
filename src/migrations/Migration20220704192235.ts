import { Migration } from '@mikro-orm/migrations';

export class Migration20220704192235 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "stat" drop constraint "stat_user_telegram_id_foreign";');

    this.addSql('alter table "user" add column "id" serial;');
    this.addSql('alter table "user" alter column "telegram_id" type bigint using ("telegram_id"::bigint);');
    this.addSql('alter table "user" alter column "telegram_id" drop not null;');
    this.addSql('alter table "user" drop constraint "user_pkey";');
    this.addSql('alter table "user" add constraint "user_pkey" primary key ("id");');

    this.addSql('alter table "stat" add column "user_id" int;');
    this.addSql('update "stat" set "user_id" = (select "id" from "user" where "telegram_id" = "stat"."user_telegram_id");');
    this.addSql('alter table "stat" alter column "user_id" set not null;')
    this.addSql('alter table "stat" add constraint "stat_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade on delete cascade;');
    this.addSql('alter table "stat" drop column "user_telegram_id";');
  }

  async down(): Promise<void> {
    this.addSql('alter table "stat" drop constraint "stat_user_id_foreign";');

    this.addSql('alter table "user" alter column "telegram_id" type bigint using ("telegram_id"::bigint);');
    this.addSql('alter table "user" alter column "telegram_id" set not null;');
    this.addSql('alter table "user" drop constraint "user_pkey";');
    this.addSql('alter table "user" drop column "id";');
    this.addSql('alter table "user" add constraint "user_pkey" primary key ("telegram_id");');

    this.addSql('alter table "stat" add column "user_telegram_id" bigint not null;');
    this.addSql('alter table "stat" add constraint "stat_user_telegram_id_foreign" foreign key ("user_telegram_id") references "user" ("telegram_id") on update cascade on delete cascade;');
    this.addSql('alter table "stat" drop column "user_id";');
  }

}
