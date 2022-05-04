import { Migration } from '@mikro-orm/migrations';

export class Migration20220504095035 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "shit" drop constraint "shit_user_id_foreign";');

    this.addSql('alter table "shit" add constraint "shit_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade on delete cascade;');
  }

  async down(): Promise<void> {
    this.addSql('alter table "shit" drop constraint "shit_user_id_foreign";');

    this.addSql('alter table "shit" add constraint "shit_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade;');
  }

}
