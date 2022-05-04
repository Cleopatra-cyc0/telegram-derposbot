import { Migration } from '@mikro-orm/migrations';

export class Migration20220504093006 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "shit" add column "date" timestamptz(0) not null;');
  }

  async down(): Promise<void> {
    this.addSql('alter table "shit" drop column "date";');
  }

}
