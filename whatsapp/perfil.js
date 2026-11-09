"use strict";

function renderPerfil() {
  if (!perfil) return;
  $("avatarPerfil").textContent = iniciais(perfil.full_name);
  $("nomePerfil").textContent = perfil.full_name || "Usuário";
  $("bioPerfil").textContent = perfil.bio || "Sem descrição.";
}

function editarPerfil() {
  abrirModal(`
    <h2>Editar perfil</h2>
    <input id="perfilNome" value="${escapeHTML(perfil.full_name || "")}" placeholder="Nome">
    <textarea id="perfilBio" placeholder="Biografia">${escapeHTML(perfil.bio || "")}</textarea>
    <div class="modal-actions">
      <button class="btn secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn" onclick="salvarPerfil()">Salvar</button>
    </div>
  `);
}

async function salvarPerfil() {
  const nome = $("perfilNome").value.trim();
  const bio = $("perfilBio").value.trim();
  if (nome.length<2) return toast("Informe um nome válido.");

  const {data,error} = await db.from("profiles")
    .update({full_name:nome,bio})
    .eq("id",usuario.id)
    .select("id,username,full_name,phone,bio,avatar_url,cover_url")
    .single();

  if (error) return erroSupabase(error,"Atualizar perfil");
  perfil = data;
  fecharModal();
  renderPerfil();
  toast("Perfil atualizado.");
}

function mostrarQR() {
  abrirModal(`
    <h2>Meu QR Code</h2>
    <div class="text-center py-6">
      <i class="fa-solid fa-qrcode text-8xl"></i>
      <p class="text-xs text-slate-400 mt-4">Identificador da conta</p>
      <p class="text-xs break-all">${escapeHTML(usuario.id)}</p>
    </div>
    <div class="modal-actions"><button class="btn secondary" onclick="fecharModal()">Fechar</button></div>
  `);
}

async function abrirPrivacidade() {
  const {data} = await db.from("user_privacy").select("*").eq("user_id",usuario.id).maybeSingle();
  const p = data || {profile_visibility:"everyone",status_visibility:"contacts",allow_messages:"everyone",show_online:true,show_last_seen:true,show_read_receipts:true};

  abrirModal(`
    <h2>Privacidade</h2>
    <label class="block text-xs text-slate-400">Perfil</label>
    <select id="privacyProfile">
      <option value="everyone" ${p.profile_visibility==="everyone"?"selected":""}>Todos</option>
      <option value="contacts" ${p.profile_visibility==="contacts"?"selected":""}>Contatos</option>
      <option value="nobody" ${p.profile_visibility==="nobody"?"selected":""}>Ninguém</option>
    </select>
    <label class="block text-xs text-slate-400 mt-2">Status</label>
    <select id="privacyStatus">
      <option value="everyone" ${p.status_visibility==="everyone"?"selected":""}>Todos</option>
      <option value="contacts" ${p.status_visibility==="contacts"?"selected":""}>Contatos</option>
    </select>
    ${switchHTML("privacyOnline","Mostrar online",p.show_online)}
    ${switchHTML("privacyReceipts","Confirmação de leitura",p.show_read_receipts)}
    <div class="modal-actions">
      <button class="btn secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn" onclick="salvarPrivacidade()">Salvar</button>
    </div>
  `);
}

function switchHTML(id,label,checked) {
  return `<label class="flex items-center justify-between py-3 text-sm border-b border-slate-700">
    ${label}<input id="${id}" type="checkbox" ${checked?"checked":""} style="width:18px;height:18px">
  </label>`;
}

async function salvarPrivacidade() {
  await db.from("user_privacy").upsert({
    user_id:usuario.id,
    profile_visibility:$("privacyProfile").value,
    status_visibility:$("privacyStatus").value,
    show_online:$("privacyOnline").checked,
    show_read_receipts:$("privacyReceipts").checked
  },{onConflict:"user_id"});

  fecharModal();
  toast("Privacidade atualizada.");
}

async function abrirNotificacoes() {
  const {data} = await db.from("user_settings").select("*").eq("user_id",usuario.id).maybeSingle();
  const s = data || {};

  abrirModal(`
    <h2>Notificações</h2>
    ${switchHTML("settingNotifications","Notificações ativadas",s.notifications_enabled!==false)}
    ${switchHTML("settingSound","Sons",s.sound_enabled!==false)}
    <div class="modal-actions">
      <button class="btn secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn" onclick="salvarNotificacoes()">Salvar</button>
    </div>
  `);
}

async function salvarNotificacoes() {
  await db.from("user_settings").upsert({
    user_id:usuario.id,
    notifications_enabled:$("settingNotifications").checked,
    sound_enabled:$("settingSound").checked
  },{onConflict:"user_id"});

  fecharModal();
  toast("Preferências salvas.");
}

async function abrirAparencia() {
  abrirModal(`
    <h2>Aparência</h2>
    <label class="text-xs text-slate-400">Tema</label>
    <select id="settingTheme">
      <option value="dark">Escuro</option>
    </select>
    <div class="modal-actions"><button class="btn secondary" onclick="fecharModal()">Fechar</button></div>
  `);
}

function mostrarSobre() {
  abrirModal(`
    <h2>NexusChat</h2>
    <p class="text-sm text-slate-300">Sincronizado via Supabase.</p>
    <div class="modal-actions"><button class="btn secondary" onclick="fecharModal()">Fechar</button></div>
  `);
}

async function sairDaConta() {
  await db.auth.signOut();
  location.replace("./login.html");
}
