import { Migration } from '@mikro-orm/migrations';

export class Migration20230105021828 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "user" add column "first_name" varchar(255) null, add column "last_name" varchar(255) null;');
  }

  async down(): Promise<void> {
    this.addSql('alter table "user" drop column "first_name";');
    this.addSql('alter table "user" drop column "last_name";');
  }

}
