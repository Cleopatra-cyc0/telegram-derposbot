import { Migration } from '@mikro-orm/migrations';

export class Migration20220704193256 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table "quote" ("id" serial primary key, "text" text not null, "author_id" int not null, "date" varchar(30) not null);');

    this.addSql('alter table "quote" add constraint "quote_author_id_foreign" foreign key ("author_id") references "user" ("id") on update cascade on delete cascade;');
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "quote" cascade;');
  }

}
