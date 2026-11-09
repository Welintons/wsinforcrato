"use strict";

let statusLista = [];

async function carregarStatus() {
  const {data,error} = await db.from("statuses")
    .select("id,user_id,status_type,content,media_path,background_color,text_color,visibility,expires_at,created_at")
    .gt("expires_at",new Date().toISOString())
    .order("created_at",{ascending:false});

  if (error) return erroSupabase(error,"Carregar status");
  statusLista = data || [];
  renderStatus();
}

function renderStatus() {
  const meus = $("meusStatus");
  if (!meus) return;
  meus.innerHTML = "";

  const meu = document.createElement("div");
  meu.className = "status-person";
  const ring = document.createElement("div");
  ring.className = "status-ring";
  ring.append(avatarHTML(perfil));
  meu.append(ring,document.createTextNode("Meu status"));
  meu.onclick = novoStatus;
  meus.append(meu);

  const lista = $("listaStatus");
  lista.innerHTML = "";

  const outros = statusLista.filter(s=>s.user_id!==usuario.id);
  if (!outros.length) {
    lista.innerHTML = '<div class="empty">Nenhum status recente.</div>';
    return;
  }

  const ids = [...new Set(outros.map(s=>s.user_id))];
  carregarPerfisStatus(ids).then(perfis=>{
    outros.forEach(s=>{
      const p = perfis.find(x=>x.id===s.user_id);
      const item = document.createElement("div");
      item.className = "item";

      const ring = document.createElement("div");
      ring.className = "status-ring";
      ring.append(avatarHTML(p || {full_name:"Usuário"}));
      item.append(ring);

      const main = document.createElement("div");
      main.className = "item-main";
      const nome = document.createElement("strong");
      nome.textContent = p?.full_name || "Usuário";
      const texto = document.createElement("div");
      texto.className = "item-preview";
      texto.textContent = s.content || "Status";
      main.append(nome,texto);
      item.append(main);

      item.onclick = ()=>abrirStatus(s,p);
      lista.append(item);
    });
  });
}

async function carregarPerfisStatus(ids) {
  if (!ids.length) return [];
  const {data} = await db.from("profiles").select("id,full_name,avatar_url").in("id",ids);
  return data || [];
}

async function novoStatus() {
  abrirModal(`
    <h2>Novo status</h2>
    <textarea id="textoStatus" placeholder="O que está acontecendo?"></textarea>
    <div class="modal-actions">
      <button class="btn secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn" onclick="publicarStatus()">Publicar</button>
    </div>
  `);
}

async function publicarStatus() {
  const texto = $("textoStatus").value.trim();
  if (!texto) return toast("Escreva algo.");

  const {error} = await db.from("statuses").insert({
    user_id:usuario.id,status_type:"text",content:texto,visibility:"contacts"
  });

  if (error) return erroSupabase(error,"Publicar status");
  fecharModal();
  await carregarStatus();
  toast("Status publicado.");
}

async function abrirStatus(s,p) {
  await db.from("status_views").upsert({status_id:s.id,viewer_id:usuario.id},{onConflict:"status_id,viewer_id"});

  abrirModal(`
    <h2>${escapeHTML(p?.full_name || "Status")}</h2>
    <div class="py-8 text-center">
      <p class="text-base">${escapeHTML(s.content || "")}</p>
      <small class="text-slate-400">${dataRelativa(s.created_at)}</small>
    </div>
    <div class="modal-actions">
      <button class="btn secondary" onclick="fecharModal()">Fechar</button>
      <button class="btn" onclick="reagirStatus('${s.id}')">❤️ Reagir</button>
    </div>
  `);
}

async function reagirStatus(id) {
  await db.from("status_reactions").upsert({status_id:id,user_id:usuario.id,reaction:"❤️"},{onConflict:"status_id,user_id"});
  fecharModal();
  toast("Reação registrada.");
}
