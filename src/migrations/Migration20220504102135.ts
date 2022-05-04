import { Migration } from '@mikro-orm/migrations';

export class Migration20220504102135 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "shit" alter column "date" type varchar(30) using ("date"::varchar(30));');
  }

  async down(): Promise<void> {
    this.addSql('alter table "shit" alter column "date" type timestamptz(0) using ("date"::timestamptz(0));');
  }

}
