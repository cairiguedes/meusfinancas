// --- CONFIGURAÇÃO FIXA (Substitua pelos seus dados do Supabase se desejar) ---
const SUPABASE_URL_DEFAULT = "https://jjpkrdwisfvgdmlprjey.supabase.co";
const SUPABASE_KEY_DEFAULT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqcGtyZHdpc2Z2Z2RtbHByamV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3Nzk0OTMsImV4cCI6MjA5MTM1NTQ5M30.Lt1-J6FlC9pIFJ7QHq3WTzkItYJAiaEcjOm7F_726Fw";

// Instância global do cliente Supabase
let sbInstance = null;

/**
 * Inicializa ou retorna a instância ativa do Supabase.
 * Lê dinamicamente do localStorage ou das constantes fixas acima.
 */
function getSupabase() {
    if (sbInstance) return sbInstance;

    let url = localStorage.getItem('supabase_url');
    let anonKey = localStorage.getItem('supabase_anon_key');

    // Usar fallbacks fixos se não estiver configurado no localStorage
    if (!url && SUPABASE_URL_DEFAULT !== "SUA_URL_AQUI") {
        url = SUPABASE_URL_DEFAULT;
    }
    if (!anonKey && SUPABASE_KEY_DEFAULT !== "SUA_CHAVE_ANON_AQUI") {
        anonKey = SUPABASE_KEY_DEFAULT;
    }

    if (!url || !anonKey) {
        return null;
    }

    try {
        // supabase é exposto globalmente pela tag script carregada no index.html
        sbInstance = supabase.createClient(url, anonKey);
        return sbInstance;
    } catch (error) {
        console.error("Erro ao inicializar o Supabase:", error);
        return null;
    }
}

/**
 * Reseta a instância na memória (usado quando o usuário altera as chaves)
 */
function resetSupabaseInstance() {
    sbInstance = null;
}

/**
 * Verifica se as credenciais mínimas estão configuradas (no localStorage ou no código)
 */
function isSupabaseConfigured() {
    const url = localStorage.getItem('supabase_url') || (SUPABASE_URL_DEFAULT !== "SUA_URL_AQUI" ? SUPABASE_URL_DEFAULT : null);
    const anonKey = localStorage.getItem('supabase_anon_key') || (SUPABASE_KEY_DEFAULT !== "SUA_CHAVE_ANON_AQUI" ? SUPABASE_KEY_DEFAULT : null);
    return !!(url && anonKey);
}

/* =========================================================================
   SERVIÇOS DE AUTENTICAÇÃO
   ========================================================================= */

async function authSignUp(email, password) {
    const client = getSupabase();
    if (!client) throw new Error("Supabase não configurado.");
    
    const { data, error } = await client.auth.signUp({
        email,
        password
    });
    
    if (error) throw error;
    return data;
}

async function authSignIn(email, password) {
    const client = getSupabase();
    if (!client) throw new Error("Supabase não configurado.");
    
    const { data, error } = await client.auth.signInWithPassword({
        email,
        password
    });
    
    if (error) throw error;
    return data;
}

async function authSignOut() {
    const client = getSupabase();
    if (!client) return;
    
    const { error } = await client.auth.signOut();
    if (error) throw error;
}

async function authGetCurrentUser() {
    const client = getSupabase();
    if (!client) return null;
    
    const { data: { user } } = await client.auth.getUser();
    return user;
}

/**
 * Registra um callback para ouvir mudanças na sessão (login/logout)
 */
function authOnStateChange(callback) {
    const client = getSupabase();
    if (!client) return { data: { subscription: null } };
    
    return client.auth.onAuthStateChange(callback);
}

/* =========================================================================
   SERVIÇOS DE CRUD - TRANSAÇÕES
   ========================================================================= */

/**
 * Retorna as transações no período especificado
 * Filtros de data estão no formato AAAA-MM-DD
 */
async function dbGetTransactions(startDate, endDate) {
    const client = getSupabase();
    if (!client) throw new Error("Supabase não configurado.");
    
    const { data, error } = await client
        .from('transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
        
    if (error) throw error;
    return data;
}

/**
 * Retorna todas as transações de um ano específico para cálculo consolidado anual
 */
async function dbGetTransactionsForYear(year) {
    const client = getSupabase();
    if (!client) throw new Error("Supabase não configurado.");
    
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    const { data, error } = await client
        .from('transactions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });
        
    if (error) throw error;
    return data;
}

/**
 * Insere uma ou mais transações no banco.
 * Injeta dinamicamente o ID do usuário logado para validação do RLS.
 */
async function dbInsertTransactions(transactions) {
    const client = getSupabase();
    if (!client) throw new Error("Supabase não configurado.");
    
    const user = await authGetCurrentUser();
    if (!user) throw new Error("Nenhum usuário logado.");
    
    // Assegura que todos os itens tenham o user_id correto
    const payload = Array.isArray(transactions) 
        ? transactions.map(t => ({ ...t, user_id: user.id }))
        : [{ ...transactions, user_id: user.id }];
        
    const { data, error } = await client
        .from('transactions')
        .insert(payload)
        .select();
        
    if (error) throw error;
    return data;
}

/**
 * Atualiza uma transação existente
 */
async function dbUpdateTransaction(id, transactionData) {
    const client = getSupabase();
    if (!client) throw new Error("Supabase não configurado.");
    
    const { data, error } = await client
        .from('transactions')
        .update(transactionData)
        .eq('id', id)
        .select();
        
    if (error) throw error;
    return data;
}

/**
 * Remove uma transação específica por ID
 */
async function dbDeleteTransaction(id) {
    const client = getSupabase();
    if (!client) throw new Error("Supabase não configurado.");
    
    const { error } = await client
        .from('transactions')
        .delete()
        .eq('id', id);
        
    if (error) throw error;
}

/**
 * Remove todas as parcelas associadas a um grupo
 */
async function dbDeleteInstallmentGroup(groupId) {
    const client = getSupabase();
    if (!client) throw new Error("Supabase não configurado.");
    
    const { error } = await client
        .from('transactions')
        .delete()
        .eq('installment_group_id', groupId);
        
    if (error) throw error;
}
