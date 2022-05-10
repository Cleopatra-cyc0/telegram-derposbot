import { Migration } from '@mikro-orm/migrations';

export class Migration20220510120423 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "user" add column "telegram_private_chat_id" bigint null;');
    this.addSql('alter table "user" add constraint "user_telegram_private_chat_id_unique" unique ("telegram_private_chat_id");');
  }

  async down(): Promise<void> {
    this.addSql('alter table "user" drop constraint "user_telegram_private_chat_id_unique";');
    this.addSql('alter table "user" drop column "telegram_private_chat_id";');
  }

}
