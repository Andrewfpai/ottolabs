CREATE TYPE "public"."track_status" AS ENUM('active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."session_end_reason" AS ENUM('manual', 'auto_closed', 'discarded', 'manual_entry');--> statement-breakpoint
CREATE TYPE "public"."session_mode" AS ENUM('stopwatch', 'pomodoro');--> statement-breakpoint
CREATE TYPE "public"."sync_state" AS ENUM('local', 'synced', 'pending_push', 'conflict');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('p1', 'p2', 'p3');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'done', 'cancelled');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "authenticators" (
	"credential_id" text NOT NULL,
	"user_id" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"credential_public_key" text NOT NULL,
	"counter" integer NOT NULL,
	"credential_device_type" text NOT NULL,
	"credential_backed_up" boolean NOT NULL,
	"transports" text,
	CONSTRAINT "authenticators_user_id_credential_id_pk" PRIMARY KEY("user_id","credential_id"),
	CONSTRAINT "authenticators_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"color" text DEFAULT 'amber' NOT NULL,
	"icon" text DEFAULT 'book-open' NOT NULL,
	"status" "track_status" DEFAULT 'active' NOT NULL,
	"target_minutes_per_week" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "focus_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"track_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"paused_ms" integer DEFAULT 0 NOT NULL,
	"paused_at" timestamp with time zone,
	"break_ms" integer DEFAULT 0 NOT NULL,
	"mode" "session_mode" DEFAULT 'stopwatch' NOT NULL,
	"pomodoro_config" jsonb,
	"completed_cycles" integer DEFAULT 0 NOT NULL,
	"note" text,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"last_heartbeat_at" timestamp with time zone,
	"end_reason" "session_end_reason",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"track_id" uuid,
	"title" text NOT NULL,
	"notes" text,
	"due_at" timestamp with time zone,
	"is_all_day" boolean DEFAULT false NOT NULL,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"priority" "task_priority" DEFAULT 'p3' NOT NULL,
	"completed_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"google_event_id" text,
	"google_calendar_id" text,
	"google_etag" text,
	"synced_at" timestamp with time zone,
	"sync_state" "sync_state" DEFAULT 'local' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"day_start_hour" integer DEFAULT 4 NOT NULL,
	"daily_goal_minutes" integer DEFAULT 120 NOT NULL,
	"week_starts_on" integer DEFAULT 1 NOT NULL,
	"default_pomodoro" jsonb DEFAULT '{"workMinutes":25,"breakMinutes":5,"longBreakMinutes":15,"cyclesBeforeLongBreak":4}'::jsonb NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authenticators" ADD CONSTRAINT "authenticators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tracks_user_title_unique" ON "tracks" USING btree ("user_id",lower("title"));--> statement-breakpoint
CREATE INDEX "tracks_user_status_idx" ON "tracks" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "focus_sessions_one_live_per_user" ON "focus_sessions" USING btree ("user_id") WHERE "focus_sessions"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "focus_sessions_user_started_idx" ON "focus_sessions" USING btree ("user_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "focus_sessions_track_started_idx" ON "focus_sessions" USING btree ("track_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "focus_sessions_live_heartbeat_idx" ON "focus_sessions" USING btree ("last_heartbeat_at") WHERE "focus_sessions"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "tasks_user_due_idx" ON "tasks" USING btree ("user_id","due_at");--> statement-breakpoint
CREATE INDEX "tasks_user_status_idx" ON "tasks" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "tasks_track_idx" ON "tasks" USING btree ("track_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_google_event_unique" ON "tasks" USING btree ("user_id","google_event_id");