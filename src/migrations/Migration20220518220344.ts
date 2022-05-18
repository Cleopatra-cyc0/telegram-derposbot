import { Migration } from '@mikro-orm/migrations';

export class Migration20220518220344 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "task" drop constraint if exists "task_type_check";');

    this.addSql('alter table "task" add column "message_id" bigint null;');
    this.addSql('alter table "task" alter column "type" type text using ("type"::text);');
    this.addSql('alter table "task" add constraint "task_type_check" check ("type" in (\'message\', \'forwardMessage\', \'deleteMessage\'));');
  }

  async down(): Promise<void> {
    this.addSql('alter table "task" drop constraint if exists "task_type_check";');

    this.addSql('alter table "task" alter column "type" type text using ("type"::text);');
    this.addSql('alter table "task" add constraint "task_type_check" check ("type" in (\'message\', \'forwardMessage\'));');
    this.addSql('alter table "task" drop column "message_id";');
  }

}
