// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable,text,integer,primaryKey } from 'drizzle-orm/sqlite-core';
export const records=sqliteTable('daily_records',{
 owner:text('owner').notNull(),id:text('id').notNull(),kind:text('kind').notNull(),
 fields:text('fields').notNull(),revision:integer('revision').notNull().default(1)
},t=>[primaryKey({columns:[t.owner,t.id]})]);
