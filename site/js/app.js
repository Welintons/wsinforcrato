import { supabase } from './supabase.js';

console.log("WS Soluções App Inicializado");

// Função global para alternar entre as abas do aplicativo
window.switchTab = function(tabName) {
    const content = document.getElementById('app-content');
    
    // Conteúdo dinâmico de acordo com a aba selecionada
    switch(tabName) {
        case 'inicio':
            content.innerHTML = `
                <div class="space-y-4">
                    <div class="bg-cardbg border border-gray-800 p-5 rounded-xl shadow-lg">
                        <h2 class="text-xl font-bold text-neoncyan mb-1">Bem-vindo ao Portal WS</h2>
                        <p class="text-gray-400 text-sm">Gerencie suas ordens de serviço, créditos e agendamentos com rapidez e sem burocracia.</p>
                    </div>
                </div>
            `;
            break;
        case 'aparelhos':
            content.innerHTML = `
                <div class="space-y-4">
                    <h2 class="text-xl font-bold text-neoncyan">Meus Aparelhos / Ordens de Serviço</h2>
                    <p class="text-gray-400 text-sm">Acompanhe o status dos seus equipamentos em manutenção.</p>
                </div>
            `;
            break;
        case 'orcamento':
            content.innerHTML = `
                <div class="space-y-4">
                    <h2 class="text-xl font-bold text-neoncyan">Pedir Orçamento Expresso</h2>
                    <p class="text-gray-400 text-sm">Envie os detalhes do seu problema ou instalação para análise rápida.</p>
                </div>
            `;
            break;
        case 'agendamentos':
            content.innerHTML = `
                <div class="space-y-4">
                    <h2 class="text-xl font-bold text-neoncyan">Agendamentos</h2>
                    <p class="text-gray-400 text-sm">Consulte ou solicite visitas técnicas e retiradas.</p>
                </div>
            `;
            break;
        case 'perfil':
            content.innerHTML = `
                <div class="space-y-4">
                    <h2 class="text-xl font-bold text-neoncyan">Meu Perfil</h2>
                    <p class="text-gray-400 text-sm">Seus dados e autenticação via WhatsApp.</p>
                </div>
            `;
            break;
        default:
            content.innerHTML = `<div class='text-center py-12'><h2 class='text-2xl font-bold mb-2 text-neoncyan'>Aba: ${tabName}</h2></div>`;
    }
};

// Carga inicial padrão ao abrir o site
window.switchTab('inicio');
