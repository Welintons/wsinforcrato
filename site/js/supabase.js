mport { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://vnzdrnygnknpqmryptwq.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_SAGvo6mmBGV5gpuTSE86Xw_4OnqYfxw'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
