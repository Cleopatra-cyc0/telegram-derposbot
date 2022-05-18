import { Migration } from '@mikro-orm/migrations';

export class Migration20220518203610 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table "task" ("id" serial primary key, "creation_date" varchar(30) not null, "run_date" varchar(30) not null, "done" boolean not null, "type" text check ("type" in (\'message\', \'forwardMessage\')) not null, "chat_id" bigint null, "message" varchar(255) null, "from_chat_id" bigint null, "from_message_id" bigint null, "to_chat_id" bigint null, "use_copy" boolean null);');
    this.addSql('create index "task_type_index" on "task" ("type");');
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "task" cascade;');
  }

}
