import { Migration } from '@mikro-orm/migrations';

export class Migration20230103164940 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "stat_settings" alter column "forward_chat" type bigint using ("forward_chat"::bigint);');
  }

  async down(): Promise<void> {
    this.addSql('alter table "stat_settings" alter column "forward_chat" type int using ("forward_chat"::int);');
  }

}
