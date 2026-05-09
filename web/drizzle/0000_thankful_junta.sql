CREATE TABLE "job_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"language" varchar(8) NOT NULL,
	"video_r2_key" text NOT NULL,
	"audio_r2_key" text NOT NULL,
	"watermarked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_r2_key" text NOT NULL,
	"source_language" varchar(8) DEFAULT 'hi' NOT NULL,
	"target_languages" jsonb NOT NULL,
	"voice_preset" varchar(32) DEFAULT 'warm-female' NOT NULL,
	"duration_seconds" integer,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"error_message" text,
	"bull_job_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" varchar(120) NOT NULL,
	"plan" varchar(32) DEFAULT 'free' NOT NULL,
	"minutes_used_this_month" integer DEFAULT 0 NOT NULL,
	"minutes_quota" integer DEFAULT 2 NOT NULL,
	"razorpay_customer_id" varchar(64),
	"razorpay_subscription_id" varchar(64),
	"whatsapp_number" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"channel_url" text NOT NULL,
	"referrer" text,
	"utm" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "job_outputs" ADD CONSTRAINT "job_outputs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_user_idx" ON "jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "waitlist_created_at_idx" ON "waitlist" USING btree ("created_at");