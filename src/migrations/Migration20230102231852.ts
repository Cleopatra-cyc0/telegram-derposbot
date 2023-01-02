import { Migration } from '@mikro-orm/migrations';

export class Migration20230102231852 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table "stat_settings" ("user_id" int not null, "stat_type" varchar(255) not null, "current_period_start" varchar(30) not null, constraint "stat_settings_pkey" primary key ("user_id", "stat_type"));');

    this.addSql('alter table "stat_settings" add constraint "stat_settings_user_id_foreign" foreign key ("user_id") references "user" ("id") on update cascade;');
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "stat_settings" cascade;');
  }

}
