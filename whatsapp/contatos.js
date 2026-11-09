"use strict";

let contatos = [];

async function carregarAmigos() {
  const {data,error} = await db.from("contacts")
    .select("id,owner_id,contact_id,nickname,is_favorite,created_at")
    .eq("owner_id",usuario.id);

  if (error) throw error;

  const ids = (data || []).map(c=>c.contact_id);
  if (!ids.length) {
    contatos = [];
    renderAmigos();
    return;
  }

  const {data:perfis,error:erroPerfis} = await db.from("profiles")
    .select("id,username,full_name,avatar_url,bio,last_seen_at")
    .in("id",ids);

  if (erroPerfis) throw erroPerfis;

  const {data:presencas} = await db.from("user_presence")
    .select("user_id,is_online,last_seen_at")
    .in("user_id",ids);

  contatos = (data || []).map(c=>{
    const p = (perfis || []).find(x=>x.id===c.contact_id);
    const presence = (presencas || []).find(x=>x.user_id===c.contact_id);
    return {...p,contact_row_id:c.id,nickname:c.nickname,is_favorite:c.is_favorite,online:!!presence?.is_online};
  }).filter(c=>c.id);

  renderAmigos();
}

function renderAmigos() {
  const busca = ($("buscaAmigos")?.value || "").toLowerCase();
  const online = $("listaAmigos");
  const lista = $("listaContatos");
  if (!online || !lista) return;

  online.innerHTML = "";
  lista.innerHTML = "";

  const filtrados = contatos.filter(c=>
    (c.full_name || "").toLowerCase().includes(busca) ||
    (c.username || "").toLowerCase().includes(busca)
  );

  filtrados.filter(c=>c.online).forEach(c=>online.append(criarItemAmigo(c)));
  filtrados.filter(c=>!c.online).forEach(c=>lista.append(criarItemAmigo(c)));

  if (!online.children.length) online.innerHTML = '<div class="empty">Ninguém online agora.</div>';
  if (!lista.children.length) lista.innerHTML = '<div class="empty">Nenhum outro contato.</div>';
}

function criarItemAmigo(c) {
  const item = document.createElement("div");
  item.className = "item";
  item.append(avatarHTML(c,c.online));

  const main = document.createElement("div");
  main.className = "item-main";

  const nome = document.createElement("strong");
  nome.textContent = c.nickname || c.full_name;

  const status = document.createElement("div");
  status.className = "item-preview";
  status.textContent = c.online ? "Online" : (c.username ? "@"+c.username : "Offline");

  main.append(nome,status);
  item.append(main);

  const btn = document.createElement("button");
  btn.className = "icon-btn";
  btn.innerHTML = '<i class="fa-regular fa-comment"></i>';
  btn.onclick = e=>{e.stopPropagation();iniciarConversa(c.id);};
  item.append(btn);

  item.onclick = ()=>abrirPerfilContato(c.id);
  return item;
}

async function abrirAdicionarContato() {
  abrirModal(`
    <h2>Adicionar contato</h2>
    <p class="text-xs text-slate-400 mb-2">Pesquise pelo telefone cadastrado no NexusChat.</p>
    <input id="buscaContato" placeholder="Telefone com DDD">
    <button class="btn w-full mt-2" onclick="buscarContato()">Buscar</button>
    <div id="resultadoContato"></div>
    <div class="modal-actions"><button class="btn secondary" onclick="fecharModal()">Fechar</button></div>
  `);
}

async function buscarContato() {
  const telefone = $("buscaContato").value.replace(/\D/g,"");
  if (telefone.length < 10) return toast("Informe um telefone válido.");

  const {data,error} = await db.rpc("nx_find_user_by_phone",{p_phone:telefone});
  if (error) return erroSupabase(error,"Buscar contato");

  const el = $("resultadoContato");
  el.innerHTML = "";

  if (!data?.length) {
    el.innerHTML = '<p class="text-sm text-slate-400 p-3">Nenhuma pessoa encontrada.</p>';
    return;
  }

  data.forEach(p=>{
    const b = document.createElement("button");
    b.className = "setting-row w-full text-left";
    b.textContent = p.full_name + (p.username ? " · @"+p.username : "");
    b.onclick = ()=>adicionarContato(p.id);
    el.append(b);
  });
}

async function adicionarContato(id) {
  const {error} = await db.from("contacts").insert({owner_id:usuario.id,contact_id:id});
  if (error) {
    if (error.code==="23505") return toast("Este contato já está adicionado.");
    return erroSupabase(error,"Adicionar contato");
  }
  fecharModal();
  await carregarAmigos();
  toast("Contato adicionado.");
}

async function abrirPerfilContato(id) {
  let p = contatos.find(c=>c.id===id);
  if (!p) {
    const {data} = await db.from("profiles").select("id,username,full_name,bio,avatar_url").eq("id",id).maybeSingle();
    p = data;
  }
  if (!p) return;

  abrirModal(`
    <div class="text-center">
      <div class="avatar mx-auto mb-3">${escapeHTML(iniciais(p.full_name))}</div>
      <h2>${escapeHTML(p.full_name)}</h2>
      <p class="text-sm text-slate-400">${p.username ? "@"+escapeHTML(p.username) : ""}</p>
      <p class="text-sm mt-3">${escapeHTML(p.bio || "Sem descrição.")}</p>
      <div class="modal-actions justify-center">
        <button class="btn" onclick="iniciarConversa('${p.id}')">Conversar</button>
        <button class="btn secondary" onclick="fecharModal()">Fechar</button>
      </div>
    </div>
  `);
}

function abrirNovoGrupo() {
  abrirModal(`
    <h2>Novo grupo</h2>
    <input id="nomeGrupo" placeholder="Nome do grupo">
    <p class="text-xs text-slate-400 mt-2">Selecione os contatos participantes.</p>
    <div id="membrosGrupo"></div>
    <div class="modal-actions">
      <button class="btn secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn" onclick="criarGrupo()">Criar grupo</button>
    </div>
  `);

  const el = $("membrosGrupo");
  contatos.forEach(c=>{
    const label = document.createElement("label");
    label.className = "setting-row";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.value = c.id;
    check.style.width = "auto";
    label.append(check,document.createTextNode(c.full_name));
    el.append(label);
  });
}

async function criarGrupo() {
  const nome = $("nomeGrupo").value.trim();
  if (!nome) return toast("Informe o nome do grupo.");

  const ids = [...$("membrosGrupo").querySelectorAll("input:checked")].map(x=>x.value);
  const {data,error} = await db.rpc("nx_create_group",{p_title:nome,p_member_ids:ids});
  if (error) return erroSupabase(error,"Criar grupo");

  fecharModal();
  await carregarConversas();
  await abrirChat(data);
  toast("Grupo criado.");
}
