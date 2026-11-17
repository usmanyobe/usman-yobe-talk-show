import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "https://usmanyobe.github.io/usman-yobe-talk-show/";

    if (!supabaseUrl || !anonKey || !serviceKey || !vapidPublic || !vapidPrivate) {
      throw new Error("Missing required Supabase or VAPID environment secrets.");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const { data: isAdmin, error: adminError } = await userClient.rpc("is_forum_admin");
    if (adminError || isAdmin !== true) return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });

    const payload = await req.json();
    const title = String(payload.title || "USMAN YOBE TALK SHOW").slice(0, 80);
    const body = String(payload.body || "Akwai sabon bayani a tasharmu.").slice(0, 220);
    const url = String(payload.url || "./");
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: subscriptions, error: queryError } = await adminClient.from("push_subscriptions").select("id,endpoint,p256dh,auth_key");
    if (queryError) throw queryError;

    let sent = 0;
    let failed = 0;
    for (const sub of subscriptions || []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          JSON.stringify({ title, body, url, tag: "usman-yobe-announcement" })
        );
        sent++;
      } catch (err) {
        failed++;
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await adminClient.from("push_subscriptions").delete().eq("id", sub.id);
        }
        console.error("Push delivery failed", err);
      }
    }

    return new Response(JSON.stringify({ sent, failed, total: subscriptions?.length || 0 }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err?.message || "Unexpected server error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
