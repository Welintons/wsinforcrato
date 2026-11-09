
"use strict";

/* =========================================
   PROGRESSO DO PERFIL
========================================= */

function atualizarProgressoPerfil() {
  if (!perfil) return;

  const campos = [
    perfil.full_name,
    perfil.username,
    perfil.phone,
    perfil.avatar_url,
    perfil.cover_url,
    perfil.bio,
    perfil.city,
    perfil.state
  ];

  const preenchidos = campos.filter(valor =>
    String(valor || "").trim().length > 0
  ).length;

  const porcentagem = Math.round((preenchidos / campos.length) * 100);

  const texto = $("perfilProgressoTexto");
  const barra = $("perfilProgressoBarra");
  const container = $("perfilProgressoContainer");
  const status = $("perfilProgressoStatus");

  if (texto) texto.textContent = porcentagem + "%";

  if (barra) barra.style.width = porcentagem + "%";

  if (container) {
    container.setAttribute("aria-valuenow", porcentagem);
  }

  if (status) {
    if (porcentagem === 100) {
      status.textContent = "Seu perfil está completo!";
    } else {
      status.textContent =
        `${preenchidos} de 8 informações preenchidas. Complete seu perfil.`;
    }
  }

  if (barra) {
    barra.classList.toggle("bg-green-500", porcentagem === 100);
    barra.classList.toggle("bg-blue-500", porcentagem < 100);
  }
}

/* =========================================
   EXIBIÇÃO DO PERFIL
========================================= */

function renderPerfil() {
  if (!perfil) return;

  const avatar = $("avatarPerfil");
  const nome = $("nomePerfil");
  const bio = $("bioPerfil");

  if (avatar) {
    avatar.innerHTML = "";

    if (perfil.avatar_url) {
      const img = document.createElement("img");
      img.src = perfil.avatar_url;
      img.alt = perfil.full_name || "Foto de perfil";
      avatar.appendChild(img);
    } else {
      avatar.textContent = iniciais(perfil.full_name);
    }
  }

  if (nome) {
    nome.textContent = perfil.full_name || "Usuário";
  }

  if (bio) {
    bio.textContent = perfil.bio || "Sem descrição.";
  }

  atualizarProgressoPerfil();
}

/* =========================================
   EDITAR PERFIL
========================================= */

function editarPerfil() {
  if (!perfil) {
    return toast("Perfil ainda não carregado.");
  }

  abrirModal(`
    <h2>Editar perfil</h2>

    <label class="block text-xs text-slate-400 mb-1">
      Nome completo
    </label>

    <input
      id="perfilNome"
      value="${escapeHTML(perfil.full_name || "")}"
      placeholder="Seu nome"
      maxlength="100"
    >

    <label class="block text-xs text-slate-400 mb-1 mt-3">
      Biografia
    </label>

    <textarea
      id="perfilBio"
      placeholder="Conte um pouco sobre você"
      maxlength="300"
    >${escapeHTML(perfil.bio || "")}</textarea>

    <div class="modal-actions">
      <button class="btn secondary" onclick="fecharModal()">
        Cancelar
      </button>

      <button class="btn" onclick="salvarPerfil()">
        Salvar
      </button>
    </div>
  `);
}

async function salvarPerfil() {
  const nome = $("perfilNome").value.trim();
  const bio = $("perfilBio").value.trim();

  if (nome.length < 2) {
    return toast("Informe um nome válido.");
  }

  const { data, error } = await db.from("profiles")
    .update({
      full_name: nome,
      bio: bio
    })
    .eq("id", usuario.id)
    .select("id,username,full_name,phone,bio,avatar_url,cover_url")
    .single();

  if (error) {
    return erroSupabase(error, "Atualizar perfil");
  }

  perfil = {
    ...perfil,
    ...data
  };

  fecharModal();

  renderPerfil();

  toast("Perfil atualizado.");
}

/* =========================================
   QR CODE
========================================= */

function mostrarQR() {
  abrirModal(`
    <h2>Meu QR Code</h2>

    <div class="text-center py-6">
      <i class="fa-solid fa-qrcode text-8xl"></i>

      <p class="text-xs text-slate-400 mt-4">
        Identificador da conta
      </p>

      <p class="text-xs break-all">
        ${escapeHTML(usuario.id)}
      </p>
    </div>

    <div class="modal-actions">
      <button class="btn secondary" onclick="fecharModal()">
        Fechar
      </button>
    </div>
  `);
}

/* =========================================
   PRIVACIDADE
========================================= */

async function abrirPrivacidade() {
  const { data, error } = await db.from("user_privacy")
    .select("*")
    .eq("user_id", usuario.id)
    .maybeSingle();

  if (error) {
    return erroSupabase(error, "Carregar privacidade");
  }

  const p = data || {
    profile_visibility: "everyone",
    status_visibility: "contacts",
    allow_messages: "everyone",
    show_online: true,
    show_last_seen: true,
    show_read_receipts: true
  };

  abrirModal(`
    <h2>Privacidade</h2>

    <label class="block text-xs text-slate-400">
      Perfil
    </label>

    <select id="privacyProfile">
      <option value="everyone" ${p.profile_visibility === "everyone" ? "selected" : ""}>
        Todos
      </option>

      <option value="contacts" ${p.profile_visibility === "contacts" ? "selected" : ""}>
        Contatos
      </option>

      <option value="nobody" ${p.profile_visibility === "nobody" ? "selected" : ""}>
        Ninguém
      </option>
    </select>

    <label class="block text-xs text-slate-400 mt-2">
      Status
    </label>

    <select id="privacyStatus">
      <option value="everyone" ${p.status_visibility === "everyone" ? "selected" : ""}>
        Todos
      </option>

      <option value="contacts" ${p.status_visibility === "contacts" ? "selected" : ""}>
        Contatos
      </option>
    </select>

    ${switchHTML("privacyOnline", "Mostrar online", p.show_online)}

    ${switchHTML("privacyReceipts", "Confirmação de leitura", p.show_read_receipts)}

    <div class="modal-actions">
      <button class="btn secondary" onclick="fecharModal()">
        Cancelar
      </button>

      <button class="btn" onclick="salvarPrivacidade()">
        Salvar
      </button>
    </div>
  `);
}

function switchHTML(id, label, checked) {
  return `
    <label class="flex items-center justify-between py-3 text-sm border-b border-slate-700">
      ${label}

      <input
        id="${id}"
        type="checkbox"
        ${checked ? "checked" : ""}
        style="width:18px;height:18px"
      >
    </label>
  `;
}

async function salvarPrivacidade() {
  const { error } = await db.from("user_privacy").upsert({
    user_id: usuario.id,
    profile_visibility: $("privacyProfile").value,
    status_visibility: $("privacyStatus").value,
    show_online: $("privacyOnline").checked,
    show_read_receipts: $("privacyReceipts").checked
  }, {
    onConflict: "user_id"
  });

  if (error) {
    return erroSupabase(error, "Salvar privacidade");
  }

  fecharModal();
  toast("Privacidade atualizada.");
}

/* =========================================
   NOTIFICAÇÕES
========================================= */

async function abrirNotificacoes() {
  const { data, error } = await db.from("user_settings")
    .select("*")
    .eq("user_id", usuario.id)
    .maybeSingle();

  if (error) {
    return erroSupabase(error, "Carregar notificações");
  }

  const s = data || {};

  abrirModal(`
    <h2>Notificações</h2>

    ${switchHTML(
      "settingNotifications",
      "Notificações ativadas",
      s.notifications_enabled !== false
    )}

    ${switchHTML(
      "settingSound",
      "Sons",
      s.sound_enabled !== false
    )}

    <div class="modal-actions">
      <button class="btn secondary" onclick="fecharModal()">
        Cancelar
      </button>

      <button class="btn" onclick="salvarNotificacoes()">
        Salvar
      </button>
    </div>
  `);
}

async function salvarNotificacoes() {
  const { error } = await db.from("user_settings").upsert({
    user_id: usuario.id,
    notifications_enabled: $("settingNotifications").checked,
    sound_enabled: $("settingSound").checked
  }, {
    onConflict: "user_id"
  });

  if (error) {
    return erroSupabase(error, "Salvar notificações");
  }

  fecharModal();
  toast("Preferências salvas.");
}

/* =========================================
   APARÊNCIA
========================================= */

async function abrirAparencia() {
  abrirModal(`
    <h2>Aparência</h2>

    <label class="text-xs text-slate-400">
      Tema
    </label>

    <select id="settingTheme">
      <option value="dark">Escuro</option>
    </select>

    <div class="modal-actions">
      <button class="btn secondary" onclick="fecharModal()">
        Fechar
      </button>
    </div>
  `);
}

/* =========================================
   SOBRE
========================================= */

function mostrarSobre() {
  abrirModal(`
    <h2>NexusChat</h2>

    <p class="text-sm text-slate-300">
      Sincronizado via Supabase.
    </p>

    <div class="modal-actions">
      <button class="btn secondary" onclick="fecharModal()">
        Fechar
      </button>
    </div>
  `);
}

/* =========================================
   SAIR
========================================= */

async function sairDaConta() {
  const { error } = await db.auth.signOut();

  if (error) {
    return erroSupabase(error, "Sair da conta");
  }

  location.replace("./login.html");
}
