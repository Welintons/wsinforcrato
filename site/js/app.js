import { supabase } from './supabase.js';

console.log("WS Soluções App Inicializado");

let currentUser = null;

// Verifica estado inicial ao abrir a página
function checkAuthAndInit() {
    const header = document.getElementById('app-header');
    const nav = document.getElementById('app-nav');

    if (!currentUser) {
        header.classList.add('hidden');
        nav.classList.add('hidden');
        renderLoginScreen();
    } else {
        header.classList.remove('hidden');
        nav.classList.remove('hidden');
        window.switchTab('inicio');
    }
}

// Desenha a tela de Login / Cadastro limpa
function renderLoginScreen() {
    const content = document.getElementById('app-content');
    content.innerHTML = `
        <div class="bg-cardbg border border-gray-800 p-6 rounded-2xl shadow-xl text-center space-y-5 neon-glow w-full">
            <div class="space-y-2">
                <h1 class="text-2xl font-bold text-neoncyan">⚡ WS SOLUÇÕES</h1>
                <p class="text-gray-400 text-xs">Identifique-se com o seu número de WhatsApp para aceder ao portal de serviços.</p>
            </div>
            
            <div class="space-y-3 text-left">
                <div>
                    <label class="text-xs text-gray-400 block mb-1">Seu WhatsApp</label>
                    <input type="text" id="auth-whatsapp" placeholder="Ex: 88999999999" class="w-full bg-darkbg border border-gray-800 rounded-xl p-3 text-sm focus:border-neoncyan outline-none text-white text-center tracking-wider">
                </div>
                <button onclick="handleLogin()" class="w-full bg-neoncyan text-darkbg font-bold py-3 rounded-xl hover:opacity-95 transition shadow-lg">
                    Entrar / Cadastrar
                </button>
            </div>
        </div>
    `;
}

// Lógica de Autenticação / Registo no Supabase
window.handleLogin = async function() {
    const whatsappInput = document.getElementById('auth-whatsapp').value.trim();
    if (!whatsappInput) {
        alert("Por favor, insira o número de WhatsApp.");
        return;
    }

    try {
        let { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('whatsapp', whatsappInput)
            .single();

        if (error || !data) {
            const newName = prompt("Número não registado. Digite seu nome completo para criar a conta:") || "Cliente WS";
            const { data: createdData, error: createError } = await supabase
                .from('profiles')
                .insert([{ whatsapp: whatsappInput, name: newName }])
                .select()
                .single();
                
            if (createError) {
                alert("Erro ao criar perfil. Tente novamente.");
                return;
            }
            currentUser = createdData;
        } else {
            currentUser = data;
        }

        checkAuthAndInit();
    } catch (err) {
        console.error("Erro no login:", err);
        alert("Erro ao conectar com o banco de dados.");
    }
};

window.handleLogout = function() {
    currentUser = null;
    checkAuthAndInit();
};

// Gerenciamento de Abas Internas (Só acessível logado)
window.switchTab = async function(tabName) {
    if (!currentUser) return;
    const content = document.getElementById('app-content');
    
    switch(tabName) {
        case 'inicio':
            content.innerHTML = `
                <div class="space-y-4 pb-16">
                    <div class="bg-cardbg border border-gray-800 p-5 rounded-xl shadow-lg">
                        <h2 class="text-xl font-bold text-neoncyan mb-1">Olá, ${currentUser.name}!</h2>
                        <p class="text-gray-400 text-sm">Bem-vindo ao seu painel de atendimento técnico.</p>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <button onclick="switchTab('orcamento')" class="bg-cardbg border border-gray-800 hover:border-neoncyan p-4 rounded-xl text-left transition">
                            <span class="text-2xl">📝</span>
                            <h3 class="font-bold mt-2 text-sm">Pedir Orçamento</h3>
                            <p class="text-xs text-gray-400 mt-1">Registar novo aparelho</p>
                        </button>
                        <button onclick="switchTab('aparelhos')" class="bg-cardbg border border-gray-800 hover:border-neoncyan p-4 rounded-xl text-left transition">
                            <span class="text-2xl">📱</span>
                            <h3 class="font-bold mt-2 text-sm">Meus Aparelhos</h3>
                            <p class="text-xs text-gray-400 mt-1">Ver ordens e status</p>
                        </button>
                    </div>
                </div>
            `;
            break;
            
        case 'aparelhos':
            content.innerHTML = `<div class="text-center py-12"><h2 class="text-xl font-bold text-neoncyan">A carregar aparelhos...</h2></div>`;
            await loadServiceOrders(currentUser.whatsapp);
            break;
            
        case 'orcamento':
            content.innerHTML = `
                <div class="bg-cardbg border border-gray-800 p-5 rounded-xl shadow-lg space-y-4 pb-16">
                    <h2 class="text-xl font-bold text-neoncyan">Solicitar Orçamento</h2>
                    <form onsubmit="handleBudgetSubmit(event)" class="space-y-3">
                        <div>
                            <label class="text-xs text-gray-400 block mb-1">Descrição do Aparelho / Defeito</label>
                            <textarea id="device-desc" required rows="3" class="w-full bg-darkbg border border-gray-800 rounded-lg p-3 text-sm focus:border-neoncyan outline-none text-white" placeholder="Ex: TV LG não liga / Troca de LED..."></textarea>
                        </div>
                        <button type="submit" class="w-full bg-neoncyan text-darkbg font-bold py-3 rounded-lg hover:opacity-95 transition">Enviar Solicitação</button>
                    </form>
                </div>
            `;
            break;
            
        case 'agendamentos':
            content.innerHTML = `
                <div class="space-y-4 pb-16">
                    <h2 class="text-xl font-bold text-neoncyan">Agendamentos</h2>
                    <p class="text-gray-400 text-sm">Controle de visitas técnicas e prazos.</p>
                    <div class="p-4 bg-cardbg border border-gray-800 rounded-xl text-center text-gray-400 text-xs">
                        Nenhum agendamento ativo.
                    </div>
                </div>
            `;
            break;
            
        case 'perfil':
            content.innerHTML = `
                <div class="bg-cardbg border border-gray-800 p-5 rounded-xl shadow-lg space-y-4 pb-16">
                    <h2 class="text-xl font-bold text-neoncyan">Meu Perfil</h2>
                    <div class="text-sm space-y-2 bg-darkbg p-4 rounded-xl border border-gray-800">
                        <p><span class="text-gray-400">Nome:</span> <b class="text-white">${currentUser.name}</b></p>
                        <p><span class="text-gray-400">WhatsApp:</span> <b class="text-white">${currentUser.whatsapp}</b></p>
                    </div>
                </div>
            `;
            break;
    }
};

async function loadServiceOrders(whatsapp) {
    const content = document.getElementById('app-content');
    try {
        const { data, error } = await supabase
            .from('service_orders')
            .select('*')
            .eq('client_whatsapp', whatsapp)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            content.innerHTML = `
                <div class="space-y-4 text-center py-8 pb-16">
                    <h2 class="text-xl font-bold text-neoncyan">Meus Aparelhos</h2>
                    <p class="text-gray-400 text-sm">Ainda não tem ordens de serviço registadas.</p>
                    <button onclick="switchTab('orcamento')" class="bg-neoncyan text-darkbg px-4 py-2 rounded-lg font-bold text-sm">Pedir Orçamento</button>
                </div>
            `;
            return;
        }

        let html = `<div class="space-y-4 pb-16"><div class="flex justify-between items-center"><h2 class="text-xl font-bold text-neoncyan">Aparelhos (${data.length})</h2><button onclick="switchTab('orcamento')" class="text-xs bg-neoncyan text-darkbg px-3 py-1.5 rounded-lg font-bold">+ Novo</button></div><div class="space-y-3">`;
        
        data.forEach(order => {
            html += `
                <div class="bg-cardbg border border-gray-800 p-4 rounded-xl space-y-2 shadow">
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-sm text-white">${order.device_description || 'Equipamento'}</span>
                        <span class="text-xs px-2 py-1 rounded bg-darkbg text-neoncyan border border-gray-800">${order.status || 'Pendente'}</span>
                    </div>
                    <p class="text-xs text-gray-500">Registo: ${new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
            `;
        });
        html += `</div></div>`;
        content.innerHTML = html;
    } catch (err) {
        console.error("Erro ao carregar ordens:", err);
        content.innerHTML = `<p class="text-center text-red-400 py-8">Erro ao carregar dados do Supabase.</p>`;
    }
}

window.handleBudgetSubmit = async function(e) {
    e.preventDefault();
    const device = document.getElementById('device-desc').value;

    try {
        const { error } = await supabase
            .from('service_orders')
            .insert([{ 
                client_name: currentUser.name, 
                client_whatsapp: currentUser.whatsapp, 
                device_description: device, 
                status: 'Em Análise' 
            }]);

        if (error) throw error;

        alert("Orçamento enviado com sucesso!");
        window.switchTab('aparelhos');
    } catch (err) {
        console.error("Erro ao enviar:", err);
        alert("Erro ao gravar no banco de dados.");
    }
};

// Inicialização: Mostra a tela de login ao carregar a página
checkAuthAndInit();
