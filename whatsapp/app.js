
"use strict";

const db = window.nexusSupabase || window.supabaseClient;

if (!db) {
  document.body.style.visibility = "visible";

  const modal = document.getElementById("modal");
  const backdrop = document.getElementById("modalBackdrop");

  if (modal && backdrop) {
    modal.innerHTML = `
      <div class="text-center py-3">
        <i class="fa-solid fa-circle-exclamation text-4xl text-red-400 mb-4"></i>
        <h2>Erro de conexão</h2>
        <p class="text-sm text-slate-300 my-4">
          Cliente Supabase não carregado. Confira o arquivo supabase.js.
        </p>
        <div class="modal-actions justify-center">
          <button class="btn" onclick="location.reload()">
            Tentar novamente
          </button>
        </div>
      </div>
    `;
    backdrop.classList.add("show");
  } else {
    document.body.innerHTML = `
      <div style="padding:30px;color:white;background:#101827;min-height:100vh">
        <h2>Erro de conexão</h2>
        <p>Cliente Supabase não carregado. Confira supabase.js.</p>
        <button onclick="location.reload()">Tentar novamente</button>
      </div>
    `;
  }

  throw new Error("Cliente Supabase indisponível.");
}

const $ = id => document.getElementById(id);

let usuario = null;
let perfil = null;
let conversaAtual = null;
let mensagensAtuais = [];
let respostaAtual = null;
let filtroAtual = "todas";
let canalMensagens = null;
let canalNotificacoes = null;
let canalPresenca = null;
let ultimaAba = "conversas";
let carregando = false;

function toast(msg) {
  const el = $("toast");
  if (!el) return;

  el.textContent = msg;
  el.classList.add("show");

  clearTimeout(window.toastTimer);

  window.toastTimer = setTimeout(
    () => el.classList.remove("show"),
    2800
  );
}

function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function iniciais(nome) {
  return String(nome || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(x => x[0] || "")
    .join("")
    .toUpperCase();
}

function horaAtual() {
  return new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function horaBanco(valor) {
  if (!valor) return "";

  const d = new Date(valor);

  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      });
}

function dataRelativa(valor) {
  if (!valor) return "";

  const d = new Date(valor);

  if (Number.isNaN(d.getTime())) return "";

  const hoje = new Date();

  if (d.toDateString() === hoje.toDateString()) {
    return horaBanco(valor);
  }

  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit"
  });
}

function erroSupabase(erro, contexto = "Operação") {
  console.error(contexto, erro);

  const msg = erro?.message || "Erro desconhecido.";

  toast(contexto + ": " + msg);
}

function mostrarErroInicializacao(erro) {
  const mensagem = escapeHTML(
    erro?.message || "Erro desconhecido ao iniciar o NexusChat."
  );

  abrirModal(`
    <div class="text-center py-3">
      <i class="fa-solid fa-circle-exclamation text-4xl text-red-400 mb-4"></i>

      <h2>Erro ao iniciar o NexusChat</h2>

      <div class="bg-slate-900 border border-red-900 rounded-xl p-3 my-4 text-left">
        <p class="text-xs text-red-300 mb-2">
          DETALHES DO ERRO
        </p>

        <p class="text-sm text-slate-300 break-words">
          ${mensagem}
        </p>
      </div>

      <div class="modal-actions justify-center">
        <button class="btn" onclick="location.reload()">
          <i class="fa-solid fa-rotate-right mr-2"></i>
          Tentar novamente
        </button>
      </div>
    </div>
  `);
}

function avatarHTML(p, online = false) {
  const el = document.createElement("div");

  el.className = "avatar";

  const nome = p?.full_name || p?.name || p?.title || "Usuário";

  if (p?.avatar_url) {
    const img = document.createElement("img");

    img.src = p.avatar_url;
    img.alt = nome;

    el.append(img);
  } else {
    el.textContent = iniciais(nome);
  }

  if (online) {
    const dot = document.createElement("span");

    dot.className = "online-dot";

    el.append(dot);
  }

  return el;
}

async function iniciarAplicacao() {
  try {
    const { data, error } = await db.auth.getSession();

    if (error) throw error;

    if (!data.session) {
      location.replace("./login.html");
      return;
    }

    usuario = data.session.user;

    await carregarPerfilApp();
    await carregarTudo();
    await configurarRealtime();
    await atualizarPresenca(true);

    document.body.style.visibility = "visible";

  } catch (e) {
    console.error("Erro na inicialização:", e);

    document.body.style.visibility = "visible";

    mostrarErroInicializacao(e);
  }
}

document.body.style.visibility = "hidden";

db.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session) {
    location.replace("./login.html");
  }
});

async function carregarPerfilApp() {
  const { data, error } = await db.from("profiles")
    .select("id,username,full_name,phone,bio,avatar_url,cover_url,city,state,is_active")
    .eq("id", usuario.id)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error("Seu perfil ainda não existe na tabela profiles.");
  }

  if (!data.is_active) {
    await db.auth.signOut();
    throw new Error("Esta conta está desativada.");
  }

  perfil = data;

  if (!perfil.username || perfil.full_name === "Usuário") {
    abrirOnboarding();
  }

  renderPerfil();
}

function abrirOnboarding() {
  abrirModal(`
    <h2>Complete seu perfil</h2>

    <p class="text-xs text-slate-400 mb-3">
      Precisamos dessas informações para configurar sua conta.
    </p>

    <input
      id="onboardNome"
      placeholder="Seu nome"
      value="${escapeHTML(perfil.full_name === "Usuário" ? "" : perfil.full_name)}"
    >

    <input
      id="onboardUser"
      placeholder="Nome de usuário (sem espaços)"
      value="${escapeHTML(perfil.username || "")}"
    >

    <div class="modal-actions">
      <button class="btn" onclick="salvarOnboarding()">
        Salvar perfil
      </button>
    </div>
  `);
}

async function salvarOnboarding() {
  const nome = $("onboardNome").value.trim();

  const username = $("onboardUser")
    .value.trim()
    .toLowerCase();

  if (nome.length < 2) {
    return toast("Informe seu nome.");
  }

  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    return toast("Usuário: 3 a 30 caracteres, letras, números e _.");
  }

  const { data, error } = await db.from("profiles")
    .update({
      full_name: nome,
      username
    })
    .eq("id", usuario.id)
    .select("id,username,full_name,phone,bio,avatar_url,cover_url")
    .single();

  if (error) {
    return erroSupabase(error, "Não foi possível salvar");
  }

  perfil = data;

  fecharModal();
  renderPerfil();

  toast("Perfil atualizado.");
}

function mudarAba(nome, botao) {
  ultimaAba = nome;

  document.querySelectorAll(".page").forEach(p => {
    p.classList.remove("active");
  });

  $("tab-" + nome).classList.add("active");

  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.remove("active");
  });

  if (botao) {
    botao.classList.add("active");
  } else {
    const btn = [...document.querySelectorAll(".nav-btn")]
      .find(b => b.textContent.trim().toLowerCase().includes(nome));

    btn?.classList.add("active");
  }

  $("menuPrincipal").classList.remove("show");

  if (nome === "conversas") renderConversas();
  if (nome === "amigos") renderAmigos();
  if (nome === "status") carregarStatus();
  if (nome === "perfil") renderPerfil();
}

async function atualizarPresenca(online) {
  const { error } = await db.from("user_presence").upsert({
    user_id: usuario.id,
    is_online: online,
    last_seen_at: online ? null : new Date().toISOString()
  }, {
    onConflict: "user_id"
  });

  if (error) {
    console.warn("Presença:", error.message);
  }
}

document.addEventListener("visibilitychange", () => {
  if (!usuario) return;

  atualizarPresenca(!document.hidden);
});

async function configurarRealtime() {
  canalNotificacoes = db.channel("nexus-notifications-" + usuario.id)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "notifications",
      filter: "recipient_id=eq." + usuario.id
    }, payload => {
      toast(payload.new.title || "Nova notificação");
    })
    .subscribe();

  canalPresenca = db.channel("nexus-presence")
    .on("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "user_presence"
    }, () => carregarAmigos())
    .subscribe();
}

function abrirMenuPrincipal() {
  $("menuPrincipal").classList.toggle("show");
}

function abrirBuscaGlobal() {
  abrirNovaConversa();
}

function abrirModal(html) {
  $("modal").innerHTML = html;
  $("modalBackdrop").classList.add("show");
}

function fecharModal() {
  $("modalBackdrop").classList.remove("show");
}

function fecharModalFora(e) {
  if (e.target.id === "modalBackdrop") {
    fecharModal();
  }
}

async function carregarTudo() {
  if (carregando) return;

  carregando = true;

  try {
    await carregarAmigos();
    await carregarConversas();
    await carregarStatus();

    renderPerfil();

  } finally {
    carregando = false;
  }
}

document.addEventListener("click", e => {
  if (
    !e.target.closest("#menuPrincipal") &&
    !e.target.closest(".topbar")
  ) {
    $("menuPrincipal").classList.remove("show");
  }
});

window.addEventListener("pagehide", () => {
  if (usuario) {
    atualizarPresenca(false);
  }

  if (canalMensagens) {
    db.removeChannel(canalMensagens);
  }

  if (canalNotificacoes) {
    db.removeChannel(canalNotificacoes);
  }

  if (canalPresenca) {
    db.removeChannel(canalPresenca);
  }
});

iniciarAplicacao();
