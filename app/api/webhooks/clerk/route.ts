import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) {
      console.error("CLERK_WEBHOOK_SECRET is not set");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");
    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json(
        { error: "Missing Svix headers" },
        { status: 400 }
      );
    }

    const rawBody = await req.text();
    const wh = new Webhook(secret);
    let payload: { type: string; data?: { id?: string; email_addresses?: { email_address: string }[] } };
    try {
      payload = wh.verify(rawBody, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as typeof payload;
    } catch (err) {
      console.error("Svix verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    if (payload.type === "user.created") {
      const userId = payload.data?.id;
      const email =
        payload.data?.email_addresses?.[0]?.email_address ?? null;
      if (!userId) {
        return NextResponse.json(
          { error: "Missing user id in payload" },
          { status: 400 }
        );
      }

      const { error: insertError } = await supabaseAdmin
        .from("user_credits")
        .insert({
          clerk_user_id: userId,
          email: email ?? "",
          credits_balance: 0,
        });

      if (insertError) {
        console.error("Supabase insert error:", insertError);
        return NextResponse.json(
          { error: "Failed to create user_credits row" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true }, { status: 200 });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook failed" },
      { status: 500 }
    );
  }
}
