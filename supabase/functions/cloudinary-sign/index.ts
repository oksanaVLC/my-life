// Supabase Edge Function: cloudinary-sign
// Firma subidas a Cloudinary. El API secret nunca llega al navegador.
//
// Secretos (Edge Functions → Secrets):
//   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET,
//   MYLIFE_USER_ID  (tu UUID de Authentication → Users, no el correo)
// Deploy con «Verify JWT» desactivado: la función comprueba la sesión ella misma.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FOLDER = "mylife"; // fija: todas las fotos juntas, así un duplicado se detecta aunque se use en otra colección
const ALLOWED_FORMATS = "jpg,jpeg,png,webp,heic,gif";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: cors });

async function sha1Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function publicKey(): string | undefined {
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacy) return legacy;
  try {
    return JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}")[
      "default"
    ];
  } catch {
    return undefined;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const key = publicKey();
  const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
  const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
  const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");
  const allowedUserId = Deno.env.get("MYLIFE_USER_ID");
  if (
    !supabaseUrl ||
    !key ||
    !cloudName ||
    !apiKey ||
    !apiSecret ||
    !allowedUserId
  ) {
    console.error("Faltan variables de entorno");
    return json({ error: "Server configuration error" }, 500);
  }

  // 1. ¿Hay sesión válida?
  const authorization = req.headers.get("Authorization");
  if (!authorization?.match(/^Bearer\s+\S+$/i))
    return json({ error: "Unauthorized" }, 401);
  const supabase = createClient(supabaseUrl, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return json({ error: "Unauthorized" }, 401);

  // 2. ¿Eres tú?
  if (data.user.id !== allowedUserId) return json({ error: "Forbidden" }, 403);

  // 3. Huella de la foto (SHA-256 calculado en el navegador). Será su nombre en Cloudinary:
  //    la misma foto siempre tiene el mismo nombre, así que no se guarda dos veces.
  let hash = "";
  try {
    const body = await req.json();
    if (body && typeof body.hash === "string") hash = body.hash.toLowerCase();
  } catch {
    /* sin cuerpo */
  }
  if (!/^[a-f0-9]{64}$/.test(hash))
    return json({ error: "Bad request: hash" }, 400);

  // 4. Firma. Los parámetros firmados van en orden alfabético.
  //    allowed_formats: solo imágenes. overwrite=false: si ya existe, Cloudinary devuelve la que hay (existing: true).
  const params: Record<string, string> = {
    allowed_formats: ALLOWED_FORMATS,
    folder: FOLDER,
    overwrite: "false",
    public_id: hash,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const signature = await sha1Hex(toSign + apiSecret);

  return json({ cloudName, apiKey, signature, params });
});
