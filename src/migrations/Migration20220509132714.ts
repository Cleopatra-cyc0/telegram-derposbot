import { Migration } from '@mikro-orm/migrations';

export class Migration20220509132714 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "user" add column "congressus_id" int null, add column "congresssus_oauth_state" varchar(255) null;');
    this.addSql('alter table "user" add constraint "user_congressus_id_unique" unique ("congressus_id");');
    this.addSql('alter table "user" add constraint "user_congresssus_oauth_state_unique" unique ("congresssus_oauth_state");');
  }

  async down(): Promise<void> {
    this.addSql('alter table "user" drop constraint "user_congressus_id_unique";');
    this.addSql('alter table "user" drop constraint "user_congresssus_oauth_state_unique";');
    this.addSql('alter table "user" drop column "congressus_id";');
    this.addSql('alter table "user" drop column "congresssus_oauth_state";');
  }

}
