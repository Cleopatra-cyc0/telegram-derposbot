import { Migration } from '@mikro-orm/migrations';

export class Migration20221216231148 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "user" add column "telegram_username" varchar(255) null;');
  }

  async down(): Promise<void> {
    this.addSql('alter table "user" drop column "telegram_username";');
  }

}
