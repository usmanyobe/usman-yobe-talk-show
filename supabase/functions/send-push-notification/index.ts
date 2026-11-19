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
    const cleanSecret = (value: string | undefined) =>
      String(value || "").trim().replace(/^["']|["']$/g, "").replace(/\\s/g, "");
    const vapidPublic = cleanSecret(Deno.env.get("VAPID_PUBLIC_KEY"));
    const vapidPrivate = cleanSecret(Deno.env.get("VAPID_PRIVATE_KEY"));
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "https://usmanyobe.github.io/usman-yobe-talk-show/";

    if (!supabaseUrl || !anonKey || !serviceKey || !vapidPublic || !vapidPrivate) {
      throw new Error("Missing required Supabase or VAPID environment secrets.");
    }

    const authHeader = req.headers.get("Authorization") || "";
    const payload = await req.json();

    // Supabase's Edge gateway verifies the JWT signature before invoking this
    // function (verify_jwt must remain enabled). Detect the internal worker by
    // its verified service_role claim instead of comparing against a possibly
    // differently surfaced legacy/default environment secret.
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    let bearerClaims: any = null;
    try {
      const encodedPayload = bearerToken.split(".")[1];
      if (encodedPayload) {
        const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
        bearerClaims = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
      }
    } catch {
      bearerClaims = null;
    }
    const internal = bearerClaims?.role === "service_role" && payload?.mode === "process_queue";
    const adminClient = createClient(supabaseUrl, serviceKey);

    if (!internal) {
      if (!authHeader) return new Response(JSON.stringify({ error: "Missing authorization" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (userError || !userData.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
      const { data: isAdmin, error: adminError } = await userClient.rpc("is_forum_admin");
      if (adminError || isAdmin !== true) return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const publicBytes = Uint8Array.from(
      atob(vapidPublic.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(vapidPublic.length / 4) * 4, "=")),
      (char) => char.charCodeAt(0)
    );
    if (publicBytes.length !== 65) throw new Error(`VAPID_PUBLIC_KEY is invalid: decoded to ${publicBytes.length} bytes; expected 65.`);
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const sendToUsers = async (userIds: string[], title: string, body: string, url: string, tag: string, preferenceKey: string) => {
      const uniqueIds = [...new Set(userIds.filter(Boolean))];
      if (!uniqueIds.length) return { sent: 0, failed: 0, total: 0 };
      const [{ data: subscriptions, error: subError }, { data: prefs, error: prefError }] = await Promise.all([
        adminClient.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth").in("user_id", uniqueIds),
        adminClient.from("notification_preferences").select("user_id,breaking_news,latest_news,community_activity,messages,events,opportunities").in("user_id", uniqueIds),
      ]);
      if (subError) throw subError;
      if (prefError) throw prefError;
      const prefMap = new Map((prefs || []).map((p: any) => [p.user_id, p]));
      let sent = 0, failed = 0;
      for (const sub of subscriptions || []) {
        const pref: any = prefMap.get(sub.user_id);
        if (pref && pref[preferenceKey] === false) continue;
        if (!sub.endpoint || !sub.p256dh || !sub.auth) {
          failed++;
          console.error("Skipping incomplete push subscription:", sub.id);
          continue;
        }
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ title, body, url, tag })
          );
          sent++;
        } catch (err: any) {
          failed++;
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await adminClient.from("push_subscriptions").delete().eq("id", sub.id);
          }
          console.error("Push delivery failed", sub.id, err?.statusCode, err?.message);
        }
      }
      return { sent, failed, total: subscriptions?.length || 0 };
    };

    if (internal) {
      const { data: jobs, error: queueError } = await adminClient.from("push_notification_queue")
        .select("id,recipient_id,title,body,url,preference_key")
        .is("processed_at", null).order("created_at", { ascending: true }).limit(100);
      if (queueError) throw queueError;
      let sent = 0, failed = 0, processed = 0;
      for (const job of jobs || []) {
        const result = await sendToUsers([job.recipient_id], job.title, job.body, job.url || "./", "automatic-" + job.id, job.preference_key || "community_activity");
        sent += result.sent; failed += result.failed; processed++;
        const { error } = await adminClient.from("push_notification_queue")
          .update({ processed_at: new Date().toISOString(), delivery_result: result })
          .eq("id", job.id);
        if (error) console.error("Could not mark push job processed:", error.message);
      }
      return new Response(JSON.stringify({ success: true, mode: "automatic", processed, sent, failed }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const title = String(payload.title || "USMAN YOBE TALK SHOW").slice(0, 80);
    const body = String(payload.body || "Akwai sabon bayani a tasharmu.").slice(0, 220);
    const url = String(payload.url || "./");
    const { data: subscriptions, error: queryError } = await adminClient.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth");
    if (queryError) throw queryError;
    let sent = 0, failed = 0;
    for (const sub of subscriptions || []) {
      if (!sub.endpoint || !sub.p256dh || !sub.auth) { failed++; continue; }
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, url, tag: "usman-yobe-announcement" })
        );
        sent++;
      } catch (err: any) {
        failed++;
        if (err?.statusCode === 404 || err?.statusCode === 410) await adminClient.from("push_subscriptions").delete().eq("id", sub.id);
        console.error("Push delivery failed", sub.id, err?.statusCode, err?.message);
      }
    }
    return new Response(JSON.stringify({ success: true, sent, failed, total: subscriptions?.length || 0 }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err?.message || "Unexpected server error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});