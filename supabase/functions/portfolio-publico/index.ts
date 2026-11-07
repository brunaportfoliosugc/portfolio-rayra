// Edge Function pública: devolve o conteúdo do site. Só aceita GET.
// Publicar com: supabase functions deploy portfolio-publico --no-verify-jwt
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405);

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await sb
      .from("portfolio_itens")
      .select("tipo, titulo, titulo_en, youtube_id, categoria, texto_pt, texto_en, logo_url, data_mes, data_dia, ativo")
      .order("ordem", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) return json({ ok: false, error: "db_error" }, 500);

    // Só itens ativos; as datas vão todas (o site esconde a data fixa que foi desligada).
    const itens = (data ?? []).filter((i) => i.ativo === true || i.tipo === "data");
    const por = (t: string) => itens.filter((i) => i.tipo === t);

    return json({
      ok: true,
      itens,
      videos: por("video"),
      feedbacks: por("feedback"),
      marcas: por("marca"),
      nichos: por("nicho"),
      textos: por("texto"),
      fotos: por("foto"),
      contatos: por("contato"),
      servicos: por("servico"),
      datas: por("data"),
    });
  } catch (_e) {
    return json({ ok: false, error: "server_error" }, 500);
  }
});
