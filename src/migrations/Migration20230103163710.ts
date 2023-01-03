import { Migration } from "@mikro-orm/migrations"

export class Migration20230103163710 extends Migration {
  async up(): Promise<void> {
    this.addSql('alter table "stat_settings" add column "forward_chat" int null;')
    this.addSql('alter table "stat_settings" alter column "current_period_start" drop not null;')
  }

  async down(): Promise<void> {
    this.addSql('alter table "stat_settings" alter column "current_period_start" set not null;')
    this.addSql('alter table "stat_settings" drop column "forward_chat";')
  }
}
