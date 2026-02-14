CREATE TABLE "equb_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"frequency" text NOT NULL,
	"max_members" integer NOT NULL,
	"admin_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "equb_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"has_won" boolean DEFAULT false,
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "equb_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"round_number" integer NOT NULL,
	"status" text DEFAULT 'pending',
	"tx_reference" varchar(255),
	"paid_at" timestamp,
	CONSTRAINT "equb_payments_tx_reference_unique" UNIQUE("tx_reference")
);
--> statement-breakpoint
CREATE TABLE "equb_winners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"draw_date" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "equb_groups" ADD CONSTRAINT "equb_groups_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equb_members" ADD CONSTRAINT "equb_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equb_members" ADD CONSTRAINT "equb_members_group_id_equb_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."equb_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equb_payments" ADD CONSTRAINT "equb_payments_member_id_equb_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."equb_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equb_payments" ADD CONSTRAINT "equb_payments_group_id_equb_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."equb_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equb_winners" ADD CONSTRAINT "equb_winners_group_id_equb_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."equb_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equb_winners" ADD CONSTRAINT "equb_winners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;