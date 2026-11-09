
/* =====================================
   NEXUSCHAT — SUPABASE CONFIGURATION
   ===================================== */

(() => {
    "use strict";

    const SUPABASE_URL =
        "https://njesbluuspqlabnqghfx.supabase.co";

    const SUPABASE_KEY =
        "sb_publishable_jn9yjPpYEbz0w7TOIEAdYA_m_KJfUZP";

    if (!window.supabase?.createClient) {
        throw new Error(
            "Supabase JS não foi carregado."
        );
    }

    // Evita criar múltiplas instâncias
    if (window.nexusSupabase) {
        return;
    }

    const client = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY,
        {
            db: {
                schema: "public"
            },

            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            },

            realtime: {
                params: {
                    eventsPerSecond: 10
                }
            }
        }
    );

    window.nexusSupabase = client;

    // Compatibilidade com os arquivos do projeto
    window.supabaseClient = client;

})();
