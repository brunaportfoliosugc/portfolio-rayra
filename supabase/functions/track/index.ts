// Edge Function pública: grava visitas, cliques, vídeos e mensagens. Só aceita POST.
// Publicar com: supabase functions deploy track --no-verify-jwt
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const TIPOS = ["page_view", "button_click", "video_view", "video_retention"];
const texto = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch (_e) {
    return json({ ok: false, error: "json_invalido" }, 400);
  }

  const kind = body?.kind;
  const d = body?.data ?? {};

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (kind === "event") {
      if (!TIPOS.includes(d.event_type)) return json({ ok: false, error: "event_type_invalido" }, 400);
      const session = texto(d.session_id, 100);
      if (!session) return json({ ok: false, error: "session_id_obrigatorio" }, 400);

      let metadata: unknown = null;
      if (d.metadata && typeof d.metadata === "object") {
        if (JSON.stringify(d.metadata).length > 2000) {
          return json({ ok: false, error: "metadata_grande" }, 400);
        }
        metadata = d.metadata;
      }

      const { error } = await sb.from("portfolio_events").insert({
        event_type: d.event_type,
        event_name: texto(d.event_name, 200) || null,
        session_id: session,
        page_path: texto(d.page_path, 300) || null,
        metadata,
      });
      if (error) return json({ ok: false, error: "db_error" }, 500);
      return json({ ok: true });
    }

    if (kind === "lead") {
      const name = texto(d.name, 200);
      const email = texto(d.email, 200);
      if (!name) return json({ ok: false, error: "nome_obrigatorio" }, 400);
      if (!email || !email.includes("@")) return json({ ok: false, error: "email_invalido" }, 400);

      const { error } = await sb.from("portfolio_leads").insert({
        name,
        email,
        phone: texto(d.phone, 40) || null,
        brand: texto(d.brand, 200) || null,
        budget: texto(d.budget, 100) || null,
        message: texto(d.message, 5000) || null,
        source: d.source === "contact" || d.source === "popup" ? d.source : "contact",
      });
      if (error) return json({ ok: false, error: "db_error" }, 500);
      return json({ ok: true });
    }

    return json({ ok: false, error: "kind_invalido" }, 400);
  } catch (_e) {
    return json({ ok: false, error: "server_error" }, 500);
  }
});
