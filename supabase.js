/* =========================================================================
   INTEGRAÇÃO COM SUPABASE - CLIENTE DE BANCO DE DADOS E AUTENTICAÇÃO
   ========================================================================= */

// Instância global do cliente Supabase
let sbInstance = null;

/**
 * Inicializa ou retorna a instância ativa do Supabase.
 * Lê dinamicamente do localStorage para garantir a portabilidade.
 */
function getSupabase() {
    if (sbInstance) return sbInstance;

    const url = localStorage.getItem('supabase_url');
    const anonKey = localStorage.getItem('supabase_anon_key');

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
 * Verifica se as credenciais mínimas estão configuradas
 */
function isSupabaseConfigured() {
    const url = localStorage.getItem('supabase_url');
    const anonKey = localStorage.getItem('supabase_anon_key');
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
