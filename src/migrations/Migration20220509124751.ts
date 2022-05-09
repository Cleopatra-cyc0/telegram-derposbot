import { Migration } from '@mikro-orm/migrations';

export class Migration20220509124751 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "shit" drop constraint "shit_user_id_foreign";');

    this.addSql('alter table "user" alter column "telegram_id" type bigint using ("telegram_id"::bigint);');
    this.addSql('alter table "user" drop constraint "user_telegram_id_unique";');
    this.addSql('alter table "user" drop constraint "user_pkey";');
    this.addSql('alter table "user" drop column "id";');
    this.addSql('alter table "user" add constraint "user_pkey" primary key ("telegram_id");');

    this.addSql('alter table "shit" add column "user_telegram_id" bigint not null;');
    this.addSql('alter table "shit" add constraint "shit_user_telegram_id_foreign" foreign key ("user_telegram_id") references "user" ("telegram_id") on update cascade on delete cascade;');
    this.addSql('alter table "shit" drop column "user_id";');
  }

  async down(): Promise<void> {
    this.addSql('alter table "shit" drop constraint "shit_user_telegram_id_foreign";');

    this.addSql('alter table "user" add column "id" serial;');
    this.addSql('alter table "user" alter column "telegram_id" type varchar(100) using ("telegram_id"::varchar(100));');
    this.addSql('alter table "user" drop constraint "user_pkey";');
    this.addSql('alter table "user" add constraint "user_telegram_id_unique" unique ("telegram_id");');
    this.addSql('alter table "user" add constraint "user_pkey" primary key ("id");');

    this.addSql('alter table "shit" add column "user_id" int not null;');
    this.addSql('alter table "shit" add constraint "shit_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade on delete cascade;');
    this.addSql('alter table "shit" drop column "user_telegram_id";');
  }

}
