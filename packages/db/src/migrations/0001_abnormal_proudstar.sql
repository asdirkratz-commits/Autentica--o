DO $$ BEGIN
 CREATE TYPE "public"."app_env" AS ENUM('production', 'sandbox');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."tenant_status" AS ENUM('ativo', 'inativo', 'inadimplente', 'bloqueado');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'user');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."user_status" AS ENUM('active', 'inactive', 'pending');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"status" "tenant_status" DEFAULT 'ativo' NOT NULL,
	"status_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"logo_url" text,
	"internal_notes" text,
	"external_billing_id" varchar(255),
	"plan" varchar(50) DEFAULT 'basic' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"is_master_global" boolean DEFAULT false NOT NULL,
	"avatar_url" text,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_tenants" (
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"status" "user_status" DEFAULT 'pending' NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"invited_by" uuid,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone,
	CONSTRAINT "user_tenants_user_id_tenant_id_pk" PRIMARY KEY("user_id","tenant_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"description" text,
	"base_url" varchar(255) NOT NULL,
	"icon_url" text,
	"api_key" uuid DEFAULT gen_random_uuid() NOT NULL,
	"env" "app_env" DEFAULT 'production' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apps_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_subscriptions" (
	"tenant_id" uuid NOT NULL,
	"app_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_subscriptions_tenant_id_app_id_pk" PRIMARY KEY("tenant_id","app_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"ip_address" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" uuid,
	"user_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"target_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invite_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"tenant_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"invited_by" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_tenants" ADD CONSTRAINT "user_tenants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_tenants" ADD CONSTRAINT "user_tenants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_tenants" ADD CONSTRAINT "user_tenants_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app_subscriptions" ADD CONSTRAINT "app_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app_subscriptions" ADD CONSTRAINT "app_subscriptions_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tenants_status" ON "tenants" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tenants_slug" ON "tenants" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_tenants_tenant" ON "user_tenants" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_tenants_status" ON "user_tenants" ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_app_subscriptions_tenant" ON "app_subscriptions" ("tenant_id","active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_user" ON "refresh_tokens" ("user_id","revoked_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_tenant" ON "refresh_tokens" ("tenant_id","revoked_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_expires" ON "refresh_tokens" ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_tenant_date" ON "audit_logs" ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_action_date" ON "audit_logs" ("action","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_user_date" ON "audit_logs" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invite_tokens_email_tenant" ON "invite_tokens" ("email","tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invite_tokens_expires" ON "invite_tokens" ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_password_reset_user" ON "password_reset_tokens" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_password_reset_expires" ON "password_reset_tokens" ("expires_at");--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "logo_url" text;