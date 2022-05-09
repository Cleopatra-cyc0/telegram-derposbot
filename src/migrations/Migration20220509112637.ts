import { Migration } from '@mikro-orm/migrations';

export class Migration20220509112637 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "user" add constraint "user_telegram_id_unique" unique ("telegram_id");');
  }

  async down(): Promise<void> {
    this.addSql('alter table "user" drop constraint "user_telegram_id_unique";');
  }

}
