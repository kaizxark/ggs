import { mysqlTable, varchar, datetime, mysqlEnum } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  openId: varchar("open_id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  loginMethod: varchar("login_method", { length: 50 }),
  role: mysqlEnum("role", ["admin", "user"]).default("user"),
  lastSignedIn: datetime("last_signed_in"),
});

export type InsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
