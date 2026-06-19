/* =========================================================================
   LÓGICA DA APLICAÇÃO - ROTAS, EVENTOS, CÁLCULOS E GRÁFICOS
   ========================================================================= */

// --- Estado da Aplicação ---
let state = {
    currentDate: new Date(), // Filtro mensal ativo
    currentYear: new Date().getFullYear(), // Filtro anual ativo
    activeView: 'dashboard',
    transactions: [], // Transações do mês filtrado
    annualTransactions: [], // Transações do ano filtrado
    authMode: 'login',
    chartInstance: null
};

// --- Categorias Pré-definidas ---
const CATEGORIES = {
    entrada: ['Salário', 'Freelancer', 'Investimentos', 'Outros'],
    saida: ['Alimentação', 'Moradia', 'Transporte', 'Lazer', 'Saúde', 'Dízimo', 'Outros']
};

const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// --- Inicialização da Página ---
window.onload = async () => {
    // Carregar configurações iniciais no formulário de settings, se existirem
    loadConfigIntoInputs();
    
    // Verificar se as credenciais do Supabase estão configuradas
    if (!isSupabaseConfigured()) {
        openConfigModal();
    } else {
        // Escutar alterações de autenticação
        const sb = getSupabase();
        if (sb) {
            authOnStateChange(async (event, session) => {
                handleAuthState(session);
            });
            
            // Verificação inicial de usuário
            const user = await authGetCurrentUser();
            if (user) {
                updateUserProfile(user);
                showApp(true);
                navigateTo('dashboard');
            } else {
                showApp(false);
            }
        }
    }

    // Configurações do formulário de lançamentos
    setupFormDateDefault();
    populateCategoryOptions();
    toggleFormFields();
};

/* =========================================================================
   GERENCIAMENTO DE AUTENTICAÇÃO E CONEXÃO
   ========================================================================= */

/**
 * Atualiza a interface baseando-se no estado de autenticação
 */
function handleAuthState(session) {
    if (session && session.user) {
        updateUserProfile(session.user);
        showApp(true);
        // Só navega se estava na tela de login anteriormente
        if (document.getElementById('auth-overlay').style.display !== 'none') {
            navigateTo('dashboard');
        }
    } else {
        showApp(false);
    }
}

function showApp(isLogged) {
    const authOverlay = document.getElementById('auth-overlay');
    const appContainer = document.getElementById('app-container');
    
    if (isLogged) {
        authOverlay.style.display = 'none';
        appContainer.style.display = 'flex';
    } else {
        authOverlay.style.display = 'flex';
        appContainer.style.display = 'none';
        sbInstance = null; // Reseta instância
    }
}

function updateUserProfile(user) {
    const email = user.email;
    document.getElementById('profile-email').innerText = email;
    document.getElementById('profile-avatar').innerText = email.charAt(0).toUpperCase();
}

/**
 * Alterna entre login e cadastro de usuários
 */
function switchAuthTab(mode) {
    state.authMode = mode;
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const btnText = document.getElementById('auth-btn-text');
    
    if (mode === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        btnText.innerText = "Entrar na Conta";
    } else {
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
        btnText.innerText = "Criar Conta";
    }
}

/**
 * Submissão de autenticação (Login / Cadastro)
 */
async function handleAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const submitBtn = document.getElementById('btn-auth-submit');
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = `Processando... <i class="fa-solid fa-spinner fa-spin"></i>`;
    
    try {
        if (state.authMode === 'login') {
            await authSignIn(email, password);
        } else {
            await authSignUp(email, password);
            alert("Cadastro realizado! Caso o Supabase exija confirmação por e-mail, verifique sua caixa de entrada.");
            switchAuthTab('login');
        }
    } catch (error) {
        alert("Erro na autenticação: " + (error.message || error));
    } finally {
        submitBtn.disabled = false;
        switchAuthTab(state.authMode); // Restaura o botão
    }
}

async function handleLogout() {
    if (confirm("Deseja realmente sair da conta?")) {
        try {
            await authSignOut();
        } catch (error) {
            alert("Erro ao deslogar: " + error.message);
        }
    }
}

/* =========================================================================
   CONFIGURAÇÃO DE CREDENCIAIS SUPABASE (localStorage)
   ========================================================================= */

function openConfigModal() {
    document.getElementById('modal-config').classList.add('show');
}

function closeConfigModal() {
    if (!isSupabaseConfigured()) {
        alert("Atenção: É necessário configurar o Supabase para que o app funcione.");
        return;
    }
    document.getElementById('modal-config').classList.remove('show');
}

function loadConfigIntoInputs() {
    const url = localStorage.getItem('https://jjpkrdwisfvgdmlprjey.supabase.co') || '';
    const key = localStorage.getItem('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqcGtyZHdpc2Z2Z2RtbHByamV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3Nzk0OTMsImV4cCI6MjA5MTM1NTQ5M30.Lt1-J6FlC9pIFJ7QHq3WTzkItYJAiaEcjOm7F_726Fw') || '';
    
    document.getElementById('config-url').value = url;
    document.getElementById('config-anon-key').value = key;
    
    if (document.getElementById('settings-url')) {
        document.getElementById('settings-url').value = url;
        document.getElementById('settings-anon-key').value = key;
    }
}

function saveSupabaseConfig(e) {
    e.preventDefault();
    
    const isSettingsPage = e.target.id === 'settings-db-form';
    const urlId = isSettingsPage ? 'settings-url' : 'config-url';
    const keyId = isSettingsPage ? 'settings-anon-key' : 'config-anon-key';
    
    const url = document.getElementById(urlId).value.trim();
    const key = document.getElementById(keyId).value.trim();
    
    localStorage.setItem('supabase_url', url);
    localStorage.setItem('supabase_anon_key', key);
    
    resetSupabaseInstance();
    loadConfigIntoInputs();
    
    alert("Configurações do Supabase salvas com sucesso!");
    
    if (!isSettingsPage) {
        document.getElementById('modal-config').classList.remove('show');
    }
    
    // Recarregar aplicação
    window.location.reload();
}

function resetApp() {
    if (confirm("Atenção! Isso removerá as credenciais do Supabase salvas neste navegador. Deseja continuar?")) {
        localStorage.clear();
        window.location.reload();
    }
}

function exportData() {
    alert("Desenvolvido com carinho para controle de finanças familiares. Dados salvos com segurança via criptografia RLS no Supabase.");
}

/* =========================================================================
   NAVEGAÇÃO E FILTROS DE DATA
   ========================================================================= */

function navigateTo(viewName) {
    state.activeView = viewName;
    
    // Atualizar links ativos na sidebar e bottom nav
    const views = ['dashboard', 'transactions', 'annual', 'settings'];
    views.forEach(v => {
        const sidebarLink = document.getElementById(`nav-${v}`);
        const mobileLink = document.getElementById(`mobile-nav-${v}`);
        const section = document.getElementById(`view-${v}`);
        
        if (v === viewName) {
            sidebarLink?.classList.add('active');
            mobileLink?.classList.add('active');
            section?.classList.add('active');
        } else {
            sidebarLink?.classList.remove('active');
            mobileLink?.classList.remove('active');
            section?.classList.remove('active');
        }
    });
    
    // Carregar dados específicos da view
    if (viewName === 'dashboard' || viewName === 'transactions') {
        loadMonthData();
    } else if (viewName === 'annual') {
        loadAnnualData();
    } else if (viewName === 'settings') {
        loadConfigIntoInputs();
    }
}

function updateDateLabels() {
    const month = MONTH_NAMES[state.currentDate.getMonth()];
    const year = state.currentDate.getFullYear();
    
    const labelText = `${month} de ${year}`;
    document.getElementById('dashboard-date-label').innerText = labelText;
    document.getElementById('transactions-date-label').innerText = labelText;
    document.getElementById('annual-year-label').innerText = state.currentYear;
}

function adjustMonth(offset) {
    state.currentDate.setMonth(state.currentDate.getMonth() + offset);
    updateDateLabels();
    loadMonthData();
}

function adjustYear(offset) {
    state.currentYear += offset;
    updateDateLabels();
    loadAnnualData();
}

/* =========================================================================
   LÓGICA DE FORMULÁRIO DE LANÇAMENTO
   ========================================================================= */

function setupFormDateDefault() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('trans-date').value = today;
}

function populateCategoryOptions() {
    const typeSelect = document.getElementById('trans-type');
    const categorySelect = document.getElementById('trans-category');
    const selectedType = typeSelect.value;
    
    categorySelect.innerHTML = '';
    
    CATEGORIES[selectedType].forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.toLowerCase();
        option.innerText = cat;
        categorySelect.appendChild(option);
    });
}

function toggleFormFields() {
    populateCategoryOptions();
    
    const type = document.getElementById('trans-type').value;
    const groupInstallmentToggle = document.getElementById('group-installment-toggle');
    const groupTithing = document.getElementById('group-tithing');
    
    if (type === 'saida') {
        groupInstallmentToggle.style.display = 'block';
        groupTithing.style.display = 'none';
        document.getElementById('trans-auto-tithing').checked = false;
    } else {
        groupInstallmentToggle.style.display = 'none';
        groupTithing.style.display = 'block';
        document.getElementById('trans-is-installment').checked = false;
        toggleInstallmentFields();
    }
}

function toggleInstallmentFields() {
    const isInstallment = document.getElementById('trans-is-installment').checked;
    const groupQty = document.getElementById('group-installment-qty');
    
    if (isInstallment) {
        groupQty.style.display = 'block';
    } else {
        groupQty.style.display = 'none';
    }
}

function clearTransactionForm() {
    document.getElementById('trans-id').value = '';
    document.getElementById('trans-installment-group').value = '';
    document.getElementById('trans-description').value = '';
    document.getElementById('trans-amount').value = '';
    setupFormDateDefault();
    document.getElementById('trans-type').value = 'saida';
    document.getElementById('trans-frequency').value = 'variavel';
    document.getElementById('trans-is-installment').checked = false;
    document.getElementById('trans-auto-tithing').checked = false;
    
    toggleFormFields();
    toggleInstallmentFields();
    
    document.getElementById('form-title').innerHTML = `<i class="fa-solid fa-file-circle-plus"></i> Novo Lançamento`;
    document.getElementById('btn-save-transaction').innerText = "Salvar Lançamento";
    document.getElementById('btn-cancel-edit').style.display = 'none';
}

/**
 * Helper para adicionar meses de forma segura a uma string de data (AAAA-MM-DD)
 */
function addMonthsToDateString(dateStr, monthsToAdd) {
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    
    const date = new Date(year, month, day);
    date.setMonth(date.getMonth() + monthsToAdd);
    
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    
    return `${y}-${m}-${d}`;
}

/**
 * Helper para gerar um ID de grupo (UUID genérico simples)
 */
function generateGroupId() {
    return 'group_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

/**
 * Manipula a gravação de lançamentos (criação e edição)
 */
async function handleTransactionSubmit(e) {
    e.preventDefault();
    
    const transId = document.getElementById('trans-id').value;
    const description = document.getElementById('trans-description').value.trim();
    const amount = parseFloat(document.getElementById('trans-amount').value);
    const date = document.getElementById('trans-date').value;
    const type = document.getElementById('trans-type').value;
    const category = document.getElementById('trans-category').value;
    const frequency = document.getElementById('trans-frequency').value;
    
    const saveBtn = document.getElementById('btn-save-transaction');
    saveBtn.disabled = true;
    saveBtn.innerText = "Salvando...";

    try {
        if (transId) {
            // --- EDIÇÃO DE REGISTRO ---
            const updatePayload = {
                description,
                amount,
                date,
                type,
                category,
                frequency
            };
            await dbUpdateTransaction(transId, updatePayload);
            alert("Lançamento atualizado com sucesso!");
        } else {
            // --- CRIAÇÃO DE REGISTRO ---
            
            // 1. Caso seja Despesa Parcelada
            if (type === 'saida' && document.getElementById('trans-is-installment').checked) {
                const totalInstallments = parseInt(document.getElementById('trans-installments').value) || 3;
                const installmentAmount = parseFloat((amount / totalInstallments).toFixed(2));
                const groupId = generateGroupId();
                
                const installmentList = [];
                
                for (let i = 0; i < totalInstallments; i++) {
                    const installmentDate = addMonthsToDateString(date, i);
                    installmentList.push({
                        description: `${description} (${i + 1}/${totalInstallments})`,
                        amount: installmentAmount,
                        date: installmentDate,
                        type: 'saida',
                        category,
                        frequency: 'variavel',
                        installment_group_id: groupId,
                        installment_number: i + 1,
                        installment_total: totalInstallments
                    });
                }
                
                await dbInsertTransactions(installmentList);
                alert(`${totalInstallments} parcelas cadastradas com sucesso!`);
            } 
            // 2. Caso seja Receita com Dízimo Automático
            else if (type === 'entrada' && document.getElementById('trans-auto-tithing').checked) {
                const transactionsToInsert = [];
                
                // Entrada principal
                transactionsToInsert.push({
                    description,
                    amount,
                    date,
                    type: 'entrada',
                    category,
                    frequency
                });
                
                // Saída correspondente do Dízimo (10%)
                transactionsToInsert.push({
                    description: `Dízimo de: ${description}`,
                    amount: parseFloat((amount * 0.1).toFixed(2)),
                    date,
                    type: 'saida',
                    category: 'dízimo',
                    frequency: 'variavel'
                });
                
                await dbInsertTransactions(transactionsToInsert);
                alert("Renda cadastrada com desconto de dízimo (10%) gerado como despesa!");
            } 
            // 3. Lançamento Comum (Único)
            else {
                const newTransaction = {
                    description,
                    amount,
                    date,
                    type,
                    category,
                    frequency
                };
                await dbInsertTransactions(newTransaction);
                alert("Lançamento cadastrado com sucesso!");
            }
        }
        
        clearTransactionForm();
        loadMonthData();
        
        // Se estiver na aba Dashboard, vai atualizar os dados
        if (state.activeView === 'dashboard') {
            navigateTo('dashboard');
        }
        
    } catch (error) {
        alert("Erro ao salvar transação: " + error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = "Salvar Lançamento";
    }
}

/* =========================================================================
   CARREGAMENTO E PROCESSAMENTO DE DADOS
   ========================================================================= */

/**
 * Helper para obter a data inicial e final do mês corrente do state
 */
function getActiveMonthRange() {
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    
    // Início: AAAA-MM-01
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    
    // Fim: AAAA-MM-[Último Dia]
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    return { startDate, endDate };
}

/**
 * Carrega todas as movimentações do mês ativo e alimenta a interface
 */
async function loadMonthData() {
    updateDateLabels();
    const { startDate, endDate } = getActiveMonthRange();
    
    try {
        const data = await dbGetTransactions(startDate, endDate);
        state.transactions = data || [];
        
        processMonthSummaries();
        renderRecentTransactions();
        renderFullTransactionsTable();
    } catch (error) {
        console.error("Erro ao obter dados do mês:", error);
    }
}

/**
 * Calcula totais de entrada, saída, saldo e atualiza gráficos
 */
function processMonthSummaries() {
    let totalEntradas = 0;
    let totalSaidas = 0;
    
    state.transactions.forEach(t => {
        const val = parseFloat(t.amount);
        if (t.type === 'entrada') {
            totalEntradas += val;
        } else {
            totalSaidas += val;
        }
    });
    
    const saldo = totalEntradas - totalSaidas;
    
    // Formatar como Real Brasileiro (BRL)
    const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    
    document.getElementById('dashboard-total-entradas').innerText = formatter.format(totalEntradas);
    document.getElementById('dashboard-total-saidas').innerText = formatter.format(totalSaidas);
    document.getElementById('dashboard-total-saldo').innerText = formatter.format(saldo);
    
    // Estilizar Card de Saldo e Banner de Saúde Financeira
    const saldoCard = document.getElementById('saldo-card');
    const saldoCardFooter = document.getElementById('saldo-card-footer');
    const healthBanner = document.getElementById('health-banner');
    const healthIcon = document.getElementById('health-banner-icon');
    const healthText = document.getElementById('health-banner-text');
    
    if (saldo < 0) {
        // Déficit
        saldoCard.className = "glass-card summary-card saldo negativo";
        saldoCardFooter.innerText = "Atenção: Gastos superando ganhos";
        
        healthBanner.className = "health-banner deficit";
        healthIcon.className = "fa-solid fa-triangle-exclamation";
        healthText.innerHTML = `<strong>DÉFICIT!</strong> Suas saídas superaram as entradas em <strong>${formatter.format(Math.abs(saldo))}</strong> neste mês. Planeje seus cortes de gastos!`;
        healthBanner.style.display = 'flex';
    } else {
        // Superávit
        saldoCard.className = "glass-card summary-card saldo positivo";
        saldoCardFooter.innerText = "Saúde financeira estável";
        
        healthBanner.className = "health-banner superavit";
        healthIcon.className = "fa-solid fa-face-smile";
        healthText.innerHTML = `<strong>SUPERÁVIT!</strong> Saldo positivo de <strong>${formatter.format(saldo)}</strong>. Excelente controle!`;
        healthBanner.style.display = 'flex';
    }
    
    // Atualizar Gráfico Dinâmico
    updateMonthlyChart(totalEntradas, totalSaidas);
}

/**
 * Atualiza o gráfico de rosca (Entradas vs Saídas)
 */
function updateMonthlyChart(entradas, saidas) {
    const ctx = document.getElementById('monthly-chart').getContext('2d');
    
    if (state.chartInstance) {
        state.chartInstance.destroy();
    }
    
    // Se não houver movimentações, renderiza gráfico neutro
    if (entradas === 0 && saidas === 0) {
        state.chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Nenhum Lançamento'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['rgba(255, 255, 255, 0.05)'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });
        return;
    }
    
    state.chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Entradas', 'Saídas'],
            datasets: [{
                data: [entradas, saidas],
                backgroundColor: ['#10b981', '#f43f5e'],
                borderColor: '#161c36',
                borderWidth: 3,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#f3f4f6',
                        font: { family: 'Outfit', size: 12 }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

/**
 * Helper para formatar a data da tabela (AAAA-MM-DD -> DD/MM)
 */
function formatDateToShort(dateStr) {
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}`;
}

/**
 * Renderiza a lista de últimas movimentações (Dashboard)
 */
function renderRecentTransactions() {
    const container = document.getElementById('recent-transactions-list');
    container.innerHTML = '';
    
    // Mostrar no máximo as 5 mais recentes
    const recent = state.transactions.slice(0, 5);
    
    if (recent.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-folder-open"></i>
                Nenhuma movimentação neste mês.
            </div>`;
        return;
    }
    
    const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    
    recent.forEach(t => {
        const valFormatted = formatter.format(t.amount);
        const iconClass = t.type === 'entrada' ? 'fa-solid fa-arrow-up' : 'fa-solid fa-arrow-down';
        const dateFormatted = formatDateToShort(t.date);
        
        let tags = '';
        if (t.installment_number) {
            tags += `<span class="tag parcela">Parc. ${t.installment_number}/${t.installment_total}</span>`;
        }
        if (t.frequency === 'fixo') {
            tags += `<span class="tag fixo">Fixo</span>`;
        }
        
        const itemHtml = `
            <div class="transaction-item">
                <div class="transaction-icon ${t.type}">
                    <i class="${iconClass}"></i>
                </div>
                <div class="transaction-details">
                    <div class="transaction-desc">${t.description}</div>
                    <div class="transaction-meta">
                        <span>${dateFormatted}</span>
                        <span class="tag">${t.category}</span>
                        ${tags}
                    </div>
                </div>
                <div class="transaction-amount ${t.type}">
                    ${t.type === 'entrada' ? '+' : '-'} ${valFormatted}
                </div>
            </div>`;
            
        container.innerHTML += itemHtml;
    });
}

/**
 * Renderiza a tabela completa da aba de lançamentos (CRUD)
 */
function renderFullTransactionsTable() {
    const tbody = document.getElementById('transactions-table-body');
    tbody.innerHTML = '';
    
    if (state.transactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 40px;">
                    <i class="fa-solid fa-receipt" style="font-size: 2rem; display: block; margin-bottom: 10px;"></i>
                    Nenhum lançamento encontrado para este período.
                </td>
            </tr>`;
        return;
    }
    
    const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    
    state.transactions.forEach(t => {
        const valFormatted = formatter.format(t.amount);
        const dateFormatted = formatDateToShort(t.date);
        
        let tags = '';
        if (t.installment_number) {
            tags += `<span class="tag parcela" style="margin-left: 5px;">${t.installment_number}/${t.installment_total}</span>`;
        }
        if (t.frequency === 'fixo') {
            tags += `<span class="tag fixo" style="margin-left: 5px;">Fixo</span>`;
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dateFormatted}</td>
            <td style="font-weight: 500;">
                ${t.description}
                ${tags}
            </td>
            <td><span class="tag">${t.category}</span></td>
            <td class="transaction-amount ${t.type}" style="font-weight: 700;">
                ${t.type === 'entrada' ? '+' : '-'} ${valFormatted}
            </td>
            <td>
                <div class="transaction-actions" style="justify-content: flex-end;">
                    <button class="action-btn" onclick="editTransaction('${t.id}')" title="Editar Lançamento">
                        <i class="fa-regular fa-pen-to-square"></i>
                    </button>
                    <button class="action-btn delete" onclick="deleteTransaction('${t.id}', '${t.installment_group_id}')" title="Excluir Lançamento">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

/**
 * Preenche o formulário de edição com os dados da transação selecionada
 */
function editTransaction(id) {
    const t = state.transactions.find(item => item.id === id);
    if (!t) return;
    
    navigateTo('transactions'); // Abre a view correspondente
    
    document.getElementById('trans-id').value = t.id;
    document.getElementById('trans-description').value = t.description;
    document.getElementById('trans-amount').value = t.amount;
    document.getElementById('trans-date').value = t.date;
    document.getElementById('trans-type').value = t.type;
    
    toggleFormFields(); // Atualiza categorias disponíveis
    
    document.getElementById('trans-category').value = t.category.toLowerCase();
    document.getElementById('trans-frequency').value = t.frequency;
    
    // Oculta checks de novos parcelamentos durante a edição por segurança
    document.getElementById('group-installment-toggle').style.display = 'none';
    document.getElementById('group-tithing').style.display = 'none';
    
    document.getElementById('form-title').innerHTML = `<i class="fa-solid fa-file-signature"></i> Editar Lançamento`;
    document.getElementById('btn-save-transaction').innerText = "Atualizar Lançamento";
    document.getElementById('btn-cancel-edit').style.display = 'block';
}

/**
 * Exclui a transação. Caso seja parcelada, lida com exclusão em lote
 */
async function deleteTransaction(id, installmentGroupId) {
    const hasGroup = installmentGroupId && installmentGroupId !== 'null' && installmentGroupId !== 'undefined';
    
    if (hasGroup) {
        const deleteChoice = confirm(
            "Esta é uma transação parcelada vinculada a uma compra única.\n\n" +
            "Clique em [OK] para excluir TODAS as parcelas deste grupo.\n" +
            "Clique em [Cancelar] para excluir APENAS esta parcela individual."
        );
        
        try {
            if (deleteChoice) {
                await dbDeleteInstallmentGroup(installmentGroupId);
                alert("Todas as parcelas do grupo foram excluídas.");
            } else {
                await dbDeleteTransaction(id);
                alert("Apenas a parcela selecionada foi excluída.");
            }
            loadMonthData();
        } catch (error) {
            alert("Erro ao excluir transações: " + error.message);
        }
    } else {
        if (confirm("Deseja realmente excluir este lançamento?")) {
            try {
                await dbDeleteTransaction(id);
                alert("Lançamento excluído.");
                loadMonthData();
            } catch (error) {
                alert("Erro ao excluir lançamento: " + error.message);
            }
        }
    }
}

/* =========================================================================
   BALANÇO ANUAL (VISÃO CONSOLIDADA)
   ========================================================================= */

/**
 * Carrega dados anuais e calcula o fechamento mensal
 */
async function loadAnnualData() {
    updateDateLabels();
    
    try {
        const data = await dbGetTransactionsForYear(state.currentYear);
        state.annualTransactions = data || [];
        
        renderAnnualTable();
    } catch (error) {
        console.error("Erro ao obter balanço anual:", error);
    }
}

/**
 * Agrupa transações por mês e gera a tabela de balanço
 */
function renderAnnualTable() {
    const tbody = document.getElementById('annual-table-body');
    tbody.innerHTML = '';
    
    // Estrutura para os 12 meses
    const monthlyConsolidated = Array.from({ length: 12 }, (_, i) => ({
        monthIndex: i,
        entradas: 0,
        saidas: 0
    }));
    
    // Agrupar
    state.annualTransactions.forEach(t => {
        const dateParts = t.date.split('-');
        const monthIndex = parseInt(dateParts[1], 10) - 1; // 0 a 11
        
        if (monthIndex >= 0 && monthIndex < 12) {
            const amount = parseFloat(t.amount);
            if (t.type === 'entrada') {
                monthlyConsolidated[monthIndex].entradas += amount;
            } else {
                monthlyConsolidated[monthIndex].saidas += amount;
            }
        }
    });
    
    const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    
    // Popular tabela
    monthlyConsolidated.forEach(m => {
        const monthName = MONTH_NAMES[m.monthIndex];
        const saldo = m.entradas - m.saidas;
        
        let statusBadge = '';
        let saldoClass = '';
        
        if (m.entradas === 0 && m.saidas === 0) {
            statusBadge = `<span class="tag" style="background: rgba(255, 255, 255, 0.05); color: var(--text-muted)">Sem Dados</span>`;
            saldoClass = 'text-muted';
        } else if (saldo >= 0) {
            statusBadge = `<span class="tag" style="background: var(--success-glow); color: var(--success)">Superávit</span>`;
            saldoClass = 'entrada';
        } else {
            statusBadge = `<span class="tag" style="background: var(--danger-glow); color: var(--danger)">Déficit</span>`;
            saldoClass = 'saida';
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: left; font-weight: 500;">${monthName}</td>
            <td style="color: var(--success);">${formatter.format(m.entradas)}</td>
            <td style="color: var(--danger);">${formatter.format(m.saidas)}</td>
            <td class="transaction-amount ${saldoClass}" style="font-weight: 700;">
                ${saldo >= 0 ? '+' : ''}${formatter.format(saldo)}
            </td>
            <td>${statusBadge}</td>
        `;
        
        tbody.appendChild(tr);
    });
}
