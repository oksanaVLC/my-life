/**
 * Configuración pública de la app. Aquí SOLO van claves públicas:
 * la `anon key` de Supabase es pública por diseño (los datos los protege RLS).
 * El API secret de Cloudinary NUNCA va aquí: lo usa la Edge Function `cloudinary-sign`.
 *
 * Si `supabaseUrl` está vacío, la app arranca en «modo demo» con datos de ejemplo
 * guardados solo en este navegador.
 */
export const environment = {
  supabaseUrl: "https://ikmudtvvqgkudxxbxlgn.supabase.co",
  supabaseAnonKey: "sb_publishable_jw7Xc3yjlzCP6qHklDDdoQ_u0EercIz",
  cloudinaryCloudName: "",
  cloudinaryFolder: "mylife",
};
