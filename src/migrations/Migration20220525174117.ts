import { Migration } from '@mikro-orm/migrations';

export class Migration20220525174117 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "user" add column "has_dok_notifications" boolean not null;');
  }

  async down(): Promise<void> {
    this.addSql('alter table "user" drop column "has_dok_notifications";');
  }

}
