
"use strict";

/* =====================================================
   NEXUSCHAT — CONTROLADOR PRINCIPAL
   Arquivo: app.js
===================================================== */

/* =====================================================
   1. CLIENTE E ESTADO GLOBAL
===================================================== */

const db = window.nexusSupabase || window.supabaseClient;

let usuario = null;
let perfil = null;

let filtroAtual = "todas";
let mensagensAtuais = [];
let respostaAtual = null;

let aplicacaoIniciada = false;
let canalGlobal = null;
let timerPresenca = null;
let timerToast = null;
let timerAtualizacao = null;


/* =====================================================
   2. FUNÇÕES GERAIS
===================================================== */

function $(id) {
    return document.getElementById(id);
}

function escapeHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caractere => {
        const mapa = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return mapa[caractere];
    });
}

function iniciais(nome) {
    const partes = String(nome || "Usuário")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!partes.length) return "?";

    return partes.length === 1
        ? partes[0].substring(0, 2).toUpperCase()
        : (
            partes[0][0] +
            partes[partes.length - 1][0]
        ).toUpperCase();
}

function horaAtual() {
    return new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function horaBanco(data) {
    if (!data) return "";

    const valor = new Date(data);

    if (Number.isNaN(valor.getTime())) return "";

    return valor.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function dataRelativa(data) {
    if (!data) return "";

    const valor = new Date(data);

    if (Number.isNaN(valor.getTime())) return "";

    const agora = new Date();

    const hoje = new Date(
        agora.getFullYear(),
        agora.getMonth(),
        agora.getDate()
    );

    const dia = new Date(
        valor.getFullYear(),
        valor.getMonth(),
        valor.getDate()
    );

    const diferenca = Math.floor(
        (hoje - dia) / 86400000
    );

    if (diferenca === 0) {
        return horaBanco(data);
    }

    if (diferenca === 1) {
        return "Ontem";
    }

    if (diferenca < 7 && diferenca > 0) {
        return valor.toLocaleDateString("pt-BR", {
            weekday: "short"
        });
    }

    return valor.toLocaleDateString("pt-BR");
}


/* =====================================================
   3. AVATAR
===================================================== */

function avatarHTML(pessoa, online = false) {
    const nome = pessoa?.full_name || "Usuário";
    const foto = pessoa?.avatar_url;

    let conteudo;

    if (foto) {
        conteudo = `
            <img
                src="${escapeHTML(foto)}"
                alt="${escapeHTML(nome)}"
                loading="lazy"
            >
        `;
    } else {
        conteudo = escapeHTML(iniciais(nome));
    }

    return `
        <div class="avatar ${online ? "online" : ""}">
            ${conteudo}
        </div>
    `;
}


/* =====================================================
   4. TOAST E TRATAMENTO DE ERROS
===================================================== */

function toast(mensagem) {
    const elemento = $("toast");

    if (!elemento) {
        console.log("[NexusChat]", mensagem);
        return;
    }

    elemento.textContent = mensagem;
    elemento.classList.add("show");

    clearTimeout(timerToast);

    timerToast = setTimeout(() => {
        elemento.classList.remove("show");
    }, 3000);
}

function erroSupabase(erro, contexto = "Operação") {
    console.error("[NexusChat]", contexto, erro);

    let mensagem = "Ocorreu um erro inesperado.";

    if (erro?.message) {
        mensagem = erro.message;
    }

    if (erro?.code === "42501") {
        mensagem = "Você não tem permissão para realizar esta operação.";
    }

    if (erro?.code === "23505") {
        mensagem = "Este registro já existe.";
    }

    if (
        mensagem.toLowerCase().includes("failed to fetch") ||
        mensagem.toLowerCase().includes("network")
    ) {
        mensagem = "Falha de conexão. Verifique sua internet.";
    }

    toast(contexto + ": " + mensagem);
}


/* =====================================================
   5. MODAIS
===================================================== */

function abrirModal(conteudo) {
    const backdrop = $("modalBackdrop");
    const modal = $("modal");

    if (!backdrop || !modal) {
        console.error("Estrutura do modal não encontrada.");
        return;
    }

    modal.innerHTML = conteudo;

    backdrop.classList.add("show");

    const menu = $("menuPrincipal");

    if (menu) {
        menu.classList.remove("show");
    }
}

function fecharModal() {
    const backdrop = $("modalBackdrop");

    if (backdrop) {
        backdrop.classList.remove("show");
    }
}

function fecharModalFora(evento) {
    if (evento.target === $("modalBackdrop")) {
        fecharModal();
    }
}


/* =====================================================
   6. NAVEGAÇÃO ENTRE ABAS
===================================================== */

function mudarAba(aba, botao = null) {
    const abasPermitidas = [
        "conversas",
        "amigos",
        "status",
        "perfil"
    ];

    if (!abasPermitidas.includes(aba)) {
        console.warn("Aba inválida:", aba);
        return;
    }

    const pagina = $("tab-" + aba);

    if (!pagina) {
        console.error("Página não encontrada:", aba);
        return;
    }

    document.querySelectorAll(".page").forEach(elemento => {
        elemento.classList.remove("active");
    });

    document.querySelectorAll(".nav-btn").forEach(elemento => {
        elemento.classList.remove("active");
    });

    pagina.classList.add("active");

    if (botao) {
        botao.classList.add("active");
    } else {
        const botoes = document.querySelectorAll(".nav-btn");

        const indice = abasPermitidas.indexOf(aba);

        if (botoes[indice]) {
            botoes[indice].classList.add("active");
        }
    }

    const menu = $("menuPrincipal");

    if (menu) {
        menu.classList.remove("show");
    }

    if (aba === "conversas") {
        renderConversas();
    }

    if (aba === "amigos") {
        renderAmigos();
    }

    if (aba === "status") {
        renderStatus();
    }

    if (aba === "perfil") {
        renderPerfil();
    }
}


/* =====================================================
   7. MENU PRINCIPAL
===================================================== */

function abrirMenuPrincipal() {
    const menu = $("menuPrincipal");

    if (!menu) return;

    menu.classList.toggle("show");

    const menuChat = $("menuChat");

    if (menuChat) {
        menuChat.classList.remove("show");
    }
}


/* =====================================================
   8. BUSCA GLOBAL
===================================================== */

function abrirBuscaGlobal() {
    abrirModal(`
        <h2>Buscar no NexusChat</h2>

        <input
            id="buscaGlobal"
            placeholder="Buscar conversas ou contatos..."
            oninput="executarBuscaGlobal()"
            autocomplete="off"
        >

        <div id="resultadoBuscaGlobal" class="mt-3">
            <p class="text-sm text-slate-400">
                Digite para pesquisar.
            </p>
        </div>

        <div class="modal-actions">
            <button
                class="btn secondary"
                onclick="fecharModal()"
            >
                Fechar
            </button>
        </div>
    `);

    $("buscaGlobal")?.focus();
}

function executarBuscaGlobal() {
    const campo = $("buscaGlobal");
    const resultado = $("resultadoBuscaGlobal");

    if (!campo || !resultado) return;

    const termo = campo.value.trim().toLowerCase();

    resultado.innerHTML = "";

    if (!termo) {
        resultado.innerHTML = `
            <p class="text-sm text-slate-400">
                Digite para pesquisar.
            </p>
        `;
        return;
    }

    const conversasEncontradas = (conversas || []).filter(c =>
        (c.nome || "").toLowerCase().includes(termo)
    );

    const contatosEncontrados = (contatos || []).filter(c =>
        (c.full_name || "").toLowerCase().includes(termo) ||
        (c.username || "").toLowerCase().includes(termo)
    );

    if (
        !conversasEncontradas.length &&
        !contatosEncontrados.length
    ) {
        resultado.innerHTML = `
            <p class="text-sm text-slate-400 p-3">
                Nenhum resultado encontrado.
            </p>
        `;
        return;
    }

    if (conversasEncontradas.length) {
        const titulo = document.createElement("div");

        titulo.className = "section-label";
        titulo.textContent = "Conversas";

        resultado.append(titulo);

        conversasEncontradas.forEach(c => {
            const item = document.createElement("button");

            item.className = "setting-row w-full text-left";
            item.textContent = c.nome;

            item.onclick = async () => {
                fecharModal();
                mudarAba("conversas");
                await abrirChat(c.id);
            };

            resultado.append(item);
        });
    }

    if (contatosEncontrados.length) {
        const titulo = document.createElement("div");

        titulo.className = "section-label mt-3";
        titulo.textContent = "Contatos";

        resultado.append(titulo);

        contatosEncontrados.forEach(c => {
            const item = document.createElement("button");

            item.className = "setting-row w-full text-left";

            item.textContent =
                c.nickname ||
                c.full_name ||
                c.username ||
                "Usuário";

            item.onclick = () => {
                fecharModal();
                mudarAba("amigos");
                abrirPerfilContato(c.id);
            };

            resultado.append(item);
        });
    }
}


/* =====================================================
   9. CARREGAMENTO DO PERFIL
===================================================== */

async function carregarPerfilApp() {
    const { data, error } = await db.from("profiles")
        .select(
            "id,username,full_name,phone,bio,avatar_url,cover_url,city,state,is_active"
        )
        .eq("id", usuario.id)
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        perfil = {
            id: usuario.id,
            full_name: "Usuário",
            username: "",
            phone: "",
            bio: "",
            avatar_url: null,
            cover_url: null,
            city: "",
            state: "",
            is_active: true
        };

        renderPerfil();
        atualizarProgressoPerfil();

        return;
    }

    if (!data.is_active) {
        await db.auth.signOut();

        throw new Error("Esta conta está desativada.");
    }

    perfil = data;

    renderPerfil();
    atualizarProgressoPerfil();
}


/* =====================================================
   10. CARREGAMENTO DOS MÓDULOS
===================================================== */

async function carregarTudo() {
    const tarefas = [
        {
            nome: "Conversas",
            executar: carregarConversas
        },
        {
            nome: "Amigos",
            executar: carregarAmigos
        },
        {
            nome: "Status",
            executar: carregarStatus
        }
    ];

    const resultados = await Promise.allSettled(
        tarefas.map(tarefa => tarefa.executar())
    );

    resultados.forEach((resultado, indice) => {
        if (resultado.status === "rejected") {
            erroSupabase(
                resultado.reason,
                "Carregar " + tarefas[indice].nome
            );
        }
    });

    return resultados;
}


/* =====================================================
   11. PRESENÇA DO USUÁRIO
===================================================== */

async function atualizarPresenca(online = true) {
    if (!usuario?.id || !db) return;

    const { error } = await db.from("user_presence")
        .upsert({
            user_id: usuario.id,
            is_online: online,
            last_seen_at: new Date().toISOString()
        }, {
            onConflict: "user_id"
        });

    if (error) {
        console.warn(
            "Não foi possível atualizar a presença:",
            error.message
        );
    }
}

function iniciarMonitoramentoPresenca() {
    if (timerPresenca) {
        clearInterval(timerPresenca);
    }

    atualizarPresenca(true);

    timerPresenca = setInterval(() => {
        if (document.visibilityState === "visible") {
            atualizarPresenca(true);
        }
    }, 60000);
}


/* =====================================================
   12. REALTIME GLOBAL
===================================================== */

function configurarRealtime() {
    if (!usuario?.id) return;

    if (canalGlobal) {
        db.removeChannel(canalGlobal);
        canalGlobal = null;
    }

    canalGlobal = db.channel(
        "nexus-global-" + usuario.id
    );

    canalGlobal
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "contacts",
                filter: "owner_id=eq." + usuario.id
            },
            () => agendarAtualizacao("amigos")
        )
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "user_presence"
            },
            () => agendarAtualizacao("amigos")
        )
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "statuses"
            },
            () => agendarAtualizacao("status")
        )
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "messages"
            },
            payload => {
                if (payload.new?.sender_id !== usuario.id) {
                    agendarAtualizacao("conversas");
                }
            }
        )
        .subscribe(status => {
            if (status === "CHANNEL_ERROR") {
                console.warn(
                    "Falha na conexão Realtime do NexusChat."
                );
            }
        });
}

function agendarAtualizacao(tipo) {
    clearTimeout(timerAtualizacao);

    timerAtualizacao = setTimeout(async () => {
        try {
            if (tipo === "amigos") {
                await carregarAmigos();
            }

            if (tipo === "status") {
                await carregarStatus();
            }

            if (tipo === "conversas") {
                await carregarConversas();
            }
        } catch (erro) {
            console.warn(
                "Falha ao atualizar " + tipo,
                erro
            );
        }
    }, 500);
}


/* =====================================================
   13. INICIALIZAÇÃO
===================================================== */

async function iniciarAplicacao() {
    if (aplicacaoIniciada) return;

    aplicacaoIniciada = true;

    if (!db) {
        aplicacaoIniciada = false;

        document.body.style.visibility = "visible";

        toast("Não foi possível conectar ao Supabase.");

        console.error(
            "Cliente Supabase não encontrado. Verifique supabase.js."
        );

        return;
    }

    try {
        const { data, error } = await db.auth.getSession();

        if (error) throw error;

        const session = data?.session;

        if (!session?.user) {
            location.replace("./login.html");
            return;
        }

        usuario = session.user;

        await carregarPerfilApp();

        await carregarTudo();

        configurarRealtime();

        iniciarMonitoramentoPresenca();

        document.body.style.visibility = "visible";

        console.log(
            "NexusChat iniciado com sucesso.",
            usuario.id
        );

    } catch (erro) {
        document.body.style.visibility = "visible";

        console.error(
            "Erro na inicialização do NexusChat:",
            erro
        );

        if (
            erro?.message?.includes("Conta está desativada")
        ) {
            toast("Esta conta está desativada.");
            return;
        }

        toast(
            "O NexusChat iniciou com limitações. Verifique a conexão."
        );

        /*
         * Se o perfil falhar, tentamos manter a aplicação
         * utilizável, desde que exista uma sessão válida.
         */

        if (usuario?.id) {
            if (!perfil) {
                perfil = {
                    id: usuario.id,
                    full_name: "Usuário",
                    username: "",
                    phone: "",
                    bio: "",
                    avatar_url: null,
                    cover_url: null,
                    city: "",
                    state: "",
                    is_active: true
                };

                renderPerfil();
            }

            configurarRealtime();
            iniciarMonitoramentoPresenca();

            await carregarTudo();
        } else {
            aplicacaoIniciada = false;
        }
    }
}


/* =====================================================
   14. ENCERRAMENTO DA SESSÃO
===================================================== */

function configurarAutenticacao() {
    db.auth.onAuthStateChange((evento, session) => {
        if (evento === "SIGNED_OUT" || !session) {
            if (timerPresenca) {
                clearInterval(timerPresenca);
                timerPresenca = null;
            }

            if (canalGlobal) {
                db.removeChannel(canalGlobal);
                canalGlobal = null;
            }

            if (
                !location.pathname.endsWith("/login.html")
            ) {
                location.replace("./login.html");
            }
        }
    });
}


/* =====================================================
   15. EVENTOS DO DOCUMENTO
===================================================== */

function configurarEventosDocumento() {
    document.addEventListener("visibilitychange", () => {
        if (!usuario?.id) return;

        if (document.visibilityState === "visible") {
            atualizarPresenca(true);
        }
    });

    window.addEventListener("pagehide", () => {
        if (usuario?.id) {
            atualizarPresenca(false);
        }
    });

    document.addEventListener("keydown", evento => {
        if (evento.key === "Escape") {
            fecharModal();

            const menu = $("menuPrincipal");

            if (menu) {
                menu.classList.remove("show");
            }

            const menuChat = $("menuChat");

            if (menuChat) {
                menuChat.classList.remove("show");
            }
        }
    });
}


/* =====================================================
   16. INICIAR CONTROLADOR
===================================================== */

if (db) {
    configurarAutenticacao();
}

configurarEventosDocumento();

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        iniciarAplicacao,
        { once: true }
    );
} else {
    iniciarAplicacao();
}
