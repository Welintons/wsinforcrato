import { supabase } from './supabase.js';

console.log("WS Soluções App Inicializado com Sucesso");

// Estado global do usuário logado
let currentUser = null;

// Função global para alternar entre as abas do aplicativo
window.switchTab = async function(tabName) {
    const content = document.getElementById('app-content');
    
    // Destaca visualmente o botão ativo da navegação (se houver)
    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('text-neoncyan', 'font-bold'));
    
    switch(tabName) {
        case 'inicio':
            content.innerHTML = `
                <div class="space-y-4">
                    <div class="bg-cardbg border border-gray-800 p-5 rounded-xl shadow-lg">
                        <h2 class="text-xl font-bold text-neoncyan mb-1">Bem-vindo ao Portal WS</h2>
                        <p class="text-gray-400 text-sm">Gerencie suas ordens de serviço, créditos e agendamentos com rapidez e eficiência.</p>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <button onclick="switchTab('orcamento')" class="bg-cardbg border border-gray-800 hover:border-neoncyan p-4 rounded-xl text-left transition">
                            <span class="text-2xl">⚡</span>
                            <h3 class="font-bold mt-2 text-sm">Pedir Orçamento</h3>
                            <p class="text-xs text-gray-400 mt-1">Envie os detalhes do seu aparelho</p>
                        </button>
                        <button onclick="switchTab('aparelhos')" class="bg-cardbg border border-gray-800 hover:border-neoncyan p-4 rounded-xl text-left transition">
                            <span class="text-2xl">📱</span>
                            <h3 class="font-bold mt-2 text-sm">Meus Aparelhos</h3>
                            <p class="text-xs text-gray-400 mt-1">Acompanhe a manutenção</p>
                        </button>
                    </div>
                </div>
            `;
            break;
            
        case 'aparelhos':
            if (!currentUser) {
                content.innerHTML = renderAuthScreen("Faça login com seu WhatsApp para ver seus aparelhos.");
                return;
            }
            content.innerHTML = `<div class="text-center py-12"><h2 class="text-xl font-bold text-neoncyan">Carregando ordens de serviço...</h2></div>`;
            await loadServiceOrders(currentUser.whatsapp);
            break;
            
        case 'orcamento':
            content.innerHTML = `
                <div class="bg-cardbg border border-gray-800 p-5 rounded-xl shadow-lg space-y-4">
                    <h2 class="text-xl font-bold text-neoncyan">Solicitar Orçamento / Atendimento</h2>
                    <form id="budget-form" onsubmit="handleBudgetSubmit(event)" class="space-y-3">
                        <div>
                            <label class="text-xs text-gray-400 block mb-1">Seu Nome</label>
                            <input type="text" id="client-name" required class="w-full bg-darkbg border border-gray-800 rounded-lg p-3 text-sm focus:border-neoncyan outline-none" placeholder="Ex: João Silva">
                        </div>
                        <div>
                            <label class="text-xs text-gray-400 block mb-1">Seu WhatsApp</label>
                            <input type="text" id="client-whatsapp" required class="w-full bg-darkbg border border-gray-800 rounded-lg p-3 text-sm focus:border-neoncyan outline-none" placeholder="Ex: (88) 99999-9999">
                        </div>
                        <div>
                            <label class="text-xs text-gray-400 block mb-1">Descrição do Aparelho / Problema</label>
                            <textarea id="client-device" required rows="3" class="w-full bg-darkbg border border-gray-800 rounded-lg p-3 text-sm focus:border-neoncyan outline-none" placeholder="Ex: TV não liga, som mudo, instalação de PVC..."></textarea>
                        </div>
                        <button type="submit" class="w-full bg-neoncyan text-darkbg font-bold py-3 rounded-lg hover:opacity-95 transition">Enviar Solicitação</button>
                    </form>
                </div>
            `;
            break;
            
        case 'agendamentos':
            content.innerHTML = `
                <div class="space-y-4">
                    <h2 class="text-xl font-bold text-neoncyan">Agendamentos</h2>
                    <p class="text-gray-400 text-sm">Consulte ou solicite visitas técnicas e horários disponíveis.</p>
                </div>
            `;
            break;
            
        case 'perfil':
            if (!currentUser) {
                content.innerHTML = renderAuthScreen("Identifique-se com seu WhatsApp para acessar seu perfil.");
            } else {
                content.innerHTML = `
                    <div class="bg-cardbg border border-gray-800 p-5 rounded-xl shadow-lg space-y-4">
                        <h2 class="text-xl font-bold text-neoncyan">Meu Perfil</h2>
                        <div class="text-sm space-y-2">
                            <p><span class="text-gray-400">Nome:</span> <b class="text-white">${currentUser.name}</b></p>
                            <p><span class="text-gray-400">WhatsApp:</span> <b class="text-white">${currentUser.whatsapp}</b></p>
                        </div>
                        <button onclick="handleLogout()" class="w-full bg-red-500/10 text-red-400 border border-red-500/30 font-bold py-2 rounded-lg hover:bg-red-500/20 transition">Sair da Conta</button>
                    </div>
                `;
            }
            break;
    }
};

// Tela padrão de autenticação por WhatsApp
function renderAuthScreen(message) {
    return `
        <div class="bg-cardbg border border-gray-800 p-6 rounded-xl shadow-lg text-center space-y-4 max-w-md mx-auto mt-6">
            <h2 class="text-xl font-bold text-neoncyan">Autenticação via WhatsApp</h2>
            <p class="text-gray-400 text-sm">${message}</p>
            <input type="text" id="auth-whatsapp" placeholder="Digite seu WhatsApp (com DDD)" class="w-full bg-darkbg border border-gray-800 rounded-lg p-3 text-sm text-center focus:border-neoncyan outline-none">
            <button onclick="handleLogin()" class="w-full bg-neoncyan text-darkbg font-bold py-3 rounded-lg hover:opacity-95 transition">Entrar / Cadastrar</button>
        </div>
    `;
}

// Função de Login/Identificação simulada via tabela profiles
window.handleLogin = async function() {
    const whatsappInput = document.getElementById('auth-whatsapp').value.trim();
    if (!whatsappInput) {
        alert("Por favor, digite seu número de WhatsApp.");
        return;
    }

    try {
        // Tenta buscar o perfil na tabela profiles do Supabase
        let { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('whatsapp', whatsappInput)
            .single();

        if (error || !data) {
            // Se não existir, cria um cadastro rápido básico
            const newName = prompt("Número não cadastrado. Digite seu nome completo:") || "Cliente WS";
            const { data: createdData, error: createError } = await supabase
                .from('profiles')
                .insert([{ whatsapp: whatsappInput, name: newName }])
                .select()
                .single();
                
            if (createError) {
                alert("Erro ao cadastrar usuário. Tente novamente.");
                return;
            }
            currentUser = createdData;
        } else {
            currentUser = data;
        }

        alert(`Bem-vindo, ${currentUser.name}!`);
        window.switchTab('inicio');
    } catch (err) {
        console.error("Erro no login:", err);
        alert("Erro ao conectar com o banco de dados.");
    }
};

window.handleLogout = function() {
    currentUser = null;
    alert("Você saiu da sua conta.");
    window.switchTab('inicio');
};

// Função para buscar as ordens de serviço do cliente logado
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
                <div class="space-y-4 text-center py-8">
                    <h2 class="text-xl font-bold text-neoncyan">Meus Aparelhos</h2>
                    <p class="text-gray-400 text-sm">Você ainda não possui ordens de serviço cadastradas.</p>
                    <button onclick="switchTab('orcamento')" class="bg-neoncyan text-darkbg px-4 py-2 rounded-lg font-bold text-sm">Pedir Orçamento</button>
                </div>
            `;
            return;
        }

        let html = `<div class="space-y-4"><h2 class="text-xl font-bold text-neoncyan">Meus Aparelhos (${data.length})</h2><div class="space-y-3">`;
        data.forEach(order => {
            html += `
                <div class="bg-cardbg border border-gray-800 p-4 rounded-xl space-y-2">
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-sm text-white">${order.device_description || 'Equipamento'}</span>
                        <span class="text-xs px-2 py-1 rounded bg-darkbg text-neoncyan border border-gray-800">${order.status || 'Em análise'}</span>
                    </div>
                    <p class="text-xs text-gray-400">Criado em: ${new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
            `;
        });
        html += `</div></div>`;
        content.innerHTML = html;
    } catch (err) {
        console.error("Erro ao buscar ordens:", err);
        content.innerHTML = `<p class="text-center text-red-400 py-8">Erro ao carregar os dados dos aparelhos.</p>`;
    }
}

// Envio de orçamento expresso
window.handleBudgetSubmit = async function(e) {
    e.preventDefault();
    const name = document.getElementById('client-name').value;
    const whatsapp = document.getElementById('client-whatsapp').value;
    const device = document.getElementById('client-device').value;

    try {
        const { error } = await supabase
            .from('service_orders')
            .insert([{ client_name: name, client_whatsapp: whatsapp, device_description: device, status: 'Orçamento Pendente' }]);

        if (error) throw error;

        alert("Solicitação enviada com sucesso! Entraremos em contato via WhatsApp.");
        window.switchTab('inicio');
    } catch (err) {
        console.error("Erro ao enviar orçamento:", err);
        alert("Erro ao enviar solicitação.");
    }
};

// Carga inicial padrão ao abrir o site
window.switchTab('inicio');
