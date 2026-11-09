"use strict";

let conversas = [];
let conversaAtual = null;
let mediaSelecionada = null;
let gravador = null;
let partesAudio = [];
let audioBlob = null;
let audioUrl = null;
let canalMensagens = null;

async function carregarConversas() {
  const {data:participacoes,error} = await db.from("conversation_members")
    .select("conversation_id,user_id,member_role,joined_at,left_at,is_muted,is_archived,is_pinned,last_read_at")
    .eq("user_id",usuario.id)
    .is("left_at",null);

  if (error) throw error;

  const ids = (participacoes || []).map(x=>x.conversation_id);
  if (!ids.length) {
    conversas = [];
    renderConversas();
    return;
  }

  const {data:lista,error:erroConversas} = await db.from("conversations")
    .select("id,conversation_type,title,description,avatar_url,created_by,direct_key,last_message_at,is_active,created_at,updated_at")
    .in("id",ids)
    .eq("is_active",true);

  if (erroConversas) throw erroConversas;

  const {data:membros,error:erroMembros} = await db.from("conversation_members")
    .select("conversation_id,user_id,member_role,left_at,is_muted,is_archived,is_pinned,last_read_at")
    .in("conversation_id",ids)
    .is("left_at",null);

  if (erroMembros) throw erroMembros;

  const userIds = [...new Set((membros || []).map(m=>m.user_id).filter(id=>id!==usuario.id))];
  let perfis = [];

  if (userIds.length) {
    const {data,error:erroPerfis} = await db.from("profiles")
      .select("id,username,full_name,avatar_url,bio,last_seen_at")
      .in("id",userIds);
    if (erroPerfis) throw erroPerfis;
    perfis = data || [];
  }

  const {data:ultimas,error:erroMensagens} = ids.length
    ? await db.from("messages")
        .select("id,conversation_id,sender_id,message_type,content,is_deleted")
        .in("conversation_id",ids)
        .eq("is_deleted",false)
        .limit(300)
    : {data:[],error:null};

  if (erroMensagens) throw erroMensagens;

  conversas = (lista || []).map(c=>{
    const meusDados = participacoes.find(p=>p.conversation_id===c.id);
    const participantes = (membros || []).filter(m=>m.conversation_id===c.id);
    const outroMembro = participantes.find(m=>m.user_id!==usuario.id);
    const outroPerfil = perfis.find(p=>p.id===outroMembro?.user_id);
    const ultima = (ultimas || []).filter(m=>m.conversation_id===c.id).slice(-1)[0];

    return {
      ...c,
      membro:meusDados,
      participantes,
      outroPerfil,
      nome:c.conversation_type==="group" ? c.title : (outroPerfil?.full_name || "Conversa"),
      avatar:c.conversation_type==="group" ? c.avatar_url : outroPerfil?.avatar_url,
      grupo:c.conversation_type==="group",
      favorita:!!meusDados?.is_pinned,
      silenciada:!!meusDados?.is_muted,
      arquivada:!!meusDados?.is_archived,
      ultima:ultima?.content || (ultima?.message_type==="text" ? "" : "Anexo"),
      ultimaId:ultima?.id || null
    };
  });

  renderConversas();
}

function renderConversas() {
  const lista = $("listaConversas");
  if (!lista) return;
  lista.innerHTML = "";

  const busca = ($("buscaConversas")?.value || "").toLowerCase();
  const filtradas = conversas.filter(c=>{
    if ((c.nome || "").toLowerCase().includes(busca) === false) return false;
    if (filtroAtual==="favoritas" && !c.favorita) return false;
    if (filtroAtual==="grupos" && !c.grupo) return false;
    if (filtroAtual==="nao-lidas") {
      const naoLida = c.membro?.last_read_at && c.last_message_at &&
        new Date(c.last_message_at) > new Date(c.membro.last_read_at);
      if (!naoLida) return false;
    }
    return true;
  });

  $("contadorConversas").textContent = conversas.length+" conversas";

  if (!filtradas.length) {
    lista.innerHTML = '<div class="empty"><i class="fa-regular fa-comments block"></i>Nenhuma conversa encontrada.</div>';
    return;
  }

  filtradas.sort((a,b)=>Number(b.favorita)-Number(a.favorita));

  filtradas.forEach(c=>{
    const item = document.createElement("div");
    item.className = "item";

    const av = document.createElement("div");
    av.className = "avatar";
    if (c.avatar) {
      const img = document.createElement("img");
      img.src = c.avatar;
      img.alt = c.nome;
      av.append(img);
    } else av.textContent = iniciais(c.nome);

    const main = document.createElement("div");
    main.className = "item-main";

    const title = document.createElement("div");
    title.className = "item-title";
    const name = document.createElement("strong");
    name.textContent = c.nome;
    const time = document.createElement("small");
    time.textContent = dataRelativa(c.last_message_at);
    title.append(name,time);

    const preview = document.createElement("div");
    preview.className = "item-preview";
    preview.textContent = (c.grupo ? "Grupo · " : "") + (c.ultima || "Inicie uma conversa");

    main.append(title,preview);
    item.append(av,main);

    if (c.favorita) {
      const star = document.createElement("i");
      star.className = "fa-solid fa-thumbtack";
      star.style.color = "#e9bd55";
      item.append(star);
    }

    item.onclick = ()=>abrirChat(c.id);
    lista.append(item);
  });
}

function filtroConversa(tipo,el) {
  filtroAtual = tipo;
  document.querySelectorAll(".filters .filter").forEach(b=>b.classList.remove("active"));
  el.classList.add("active");
  renderConversas();
}

async function iniciarConversa(id) {
  try {
    const {data,error} = await db.rpc("nx_create_direct_conversation",{p_other_user:id});
    if (error) throw error;
    fecharModal();
    await carregarConversas();
    await abrirChat(data);
  } catch(e) { erroSupabase(e,"Não foi possível iniciar a conversa"); }
}

async function abrirNovaConversa() {
  abrirModal(`
    <h2>Nova conversa</h2>
    <p class="text-xs text-slate-400">Pesquise pelo telefone cadastrado.</p>
    <input id="novaBusca" placeholder="Telefone com DDD">
    <button class="btn w-full mt-2" onclick="buscarPessoaNova()">Buscar pessoa</button>
    <div id="resultadosNova"></div>
    <div class="modal-actions"><button class="btn secondary" onclick="fecharModal()">Fechar</button></div>
  `);
}

async function buscarPessoaNova() {
  const telefone = $("novaBusca").value.replace(/\D/g,"");
  if (telefone.length < 10) return toast("Informe um telefone válido.");

  const {data,error} = await db.rpc("nx_find_user_by_phone",{p_phone:telefone});
  if (error) return erroSupabase(error,"Busca de usuário");

  const el = $("resultadosNova");
  el.innerHTML = "";

  if (!data?.length) {
    el.innerHTML = '<p class="text-sm text-slate-400 p-3">Nenhuma pessoa encontrada.</p>';
    return;
  }

  data.forEach(p=>{
    const b = document.createElement("button");
    b.className = "setting-row w-full text-left";
    b.textContent = p.full_name + (p.username ? " · @"+p.username : "");
    b.onclick = ()=>iniciarConversa(p.id);
    el.append(b);
  });
}

async function abrirChat(id) {
  const c = conversas.find(x=>x.id===id);
  if (!c) return;
  conversaAtual = c;

  $("chatNome").textContent = c.nome;
  $("chatAvatar").textContent = iniciais(c.nome);
  $("chatStatus").textContent = c.grupo ? "Grupo" : "Conversa";
  $("screen-chat").classList.add("open");
  $("menuChat").classList.remove("show");

  await carregarMensagens();
  await marcarMensagensLidas();
  await assinarMensagens(id);
}

async function carregarMensagens() {
  if (!conversaAtual) return;
  $("mensagens").innerHTML = '<div class="loading">Carregando mensagens...</div>';

  const {data,error} = await db.from("messages")
    .select("id,conversation_id,sender_id,message_type,content,metadata,reply_to_id,forwarded_from_id,is_edited,edited_at,is_deleted")
    .eq("conversation_id",conversaAtual.id)
    .eq("is_deleted",false)
    .limit(300);

  if (error) {
    $("mensagens").innerHTML = "";
    return erroSupabase(error,"Carregar mensagens");
  }

  mensagensAtuais = data || [];
  renderMensagens();
}

function renderMensagens() {
  const el = $("mensagens");
  el.innerHTML = "";

  if (!mensagensAtuais.length) {
    el.innerHTML = '<div class="empty">Nenhuma mensagem ainda.<br>Envie a primeira mensagem.</div>';
    return;
  }

  mensagensAtuais.forEach((m,index)=>{
    const box = document.createElement("div");
    box.className = "message" + (m.sender_id===usuario.id ? " mine" : "");

    const remetente = contatos.find(c=>c.id===m.sender_id);
    if (conversaAtual?.grupo && m.sender_id!==usuario.id && remetente) {
      const nome = document.createElement("small");
      nome.textContent = remetente.full_name;
      nome.style.color = "#9dc8ff";
      box.append(nome);
    }

    if (m.message_type==="text") {
      const txt = document.createElement("div");
      txt.textContent = m.content || "";
      box.append(txt);
    } else if (m.message_type==="image" || m.message_type==="video" || m.message_type==="audio" || m.message_type==="file") {
      renderAnexoMensagem(m,box);
    } else if (m.message_type==="interactive") {
      const info = document.createElement("div");
      info.textContent = m.content || "Conteúdo interativo";
      box.append(info);
      carregarCartao(m.id,box);
    } else {
      const txt = document.createElement("div");
      txt.textContent = m.content || "Mensagem";
      box.append(txt);
    }

    if (m.is_edited) {
      const editado = document.createElement("small");
      editado.textContent = "Editada";
      editado.style.color = "#bdd7f7";
      box.append(editado);
    }

    const time = document.createElement("span");
    time.className = "message-time";
    time.textContent = m.created_at ? horaBanco(m.created_at) : "";
    box.append(time);

    const actions = document.createElement("div");
    actions.className = "message-actions";

    const reply = document.createElement("button");
    reply.textContent = "Responder";
    reply.onclick = ()=>responderMensagem(index);

    const react = document.createElement("button");
    react.textContent = "❤️";
    react.onclick = ()=>reagirMensagem(m.id,"❤️");

    const more = document.createElement("button");
    more.innerHTML = '<i class="fa-solid fa-ellipsis"></i>';
    more.onclick = ()=>menuMensagem(m.id);

    actions.append(reply,react,more);
    box.append(actions);
    el.append(box);
  });

  el.scrollTop = el.scrollHeight;
}

async function renderAnexoMensagem(m,box) {
  const {data,error} = await db.from("message_attachments")
    .select("id,bucket_name,object_path,file_name,mime_type")
    .eq("message_id",m.id)
    .maybeSingle();

  if (error || !data) return;

  const {data:signed,error:signError} = await db.storage
    .from(data.bucket_name)
    .createSignedUrl(data.object_path,3600);

  if (signError || !signed?.signedUrl) return;

  const url = signed.signedUrl;
  let media;

  if (data.mime_type?.startsWith("image/")) {
    media = document.createElement("img");
    media.src = url;
  } else if (data.mime_type?.startsWith("video/")) {
    media = document.createElement("video");
    media.src = url;
    media.controls = true;
  } else if (data.mime_type?.startsWith("audio/")) {
    media = document.createElement("audio");
    media.src = url;
    media.controls = true;
  } else {
    media = document.createElement("a");
    media.href = url;
    media.target = "_blank";
    media.rel = "noopener";
    media.textContent = data.file_name || "Abrir arquivo";
  }

  media.className = "preview-media";
  box.insertBefore(media,box.firstChild);
}

async function enviarMensagem() {
  if (!exigirConversa()) return;

  const campo = $("campoMensagem");
  const texto = campo.value.trim();
  if (!texto) return;

  const payload = {
    conversation_id:conversaAtual.id,
    sender_id:usuario.id,
    message_type:"text",
    content:texto,
    metadata:{},
    reply_to_id:respostaAtual?.id || null
  };

  const {data,error} = await db.from("messages").insert(payload).select().single();
  if (error) return erroSupabase(error,"Enviar mensagem");

  campo.value = "";
  cancelarResposta();
  mensagensAtuais.push(data);
  renderMensagens();
  await carregarConversas();
}

function teclaEnviar(e) {
  if (e.key==="Enter" && !e.shiftKey) {
    e.preventDefault();
    enviarMensagem();
  }
}

function responderMensagem(index) {
  const m = mensagensAtuais[index];
  if (!m) return;
  respostaAtual = m;
  $("replyText").textContent = "Respondendo: " + (m.content || "Mensagem");
  $("replyPreview").classList.add("show");
  $("campoMensagem").focus();
}

function cancelarResposta() {
  respostaAtual = null;
  $("replyPreview").classList.remove("show");
}

async function reagirMensagem(messageId,emoji) {
  const existente = await db.from("message_reactions")
    .select("id,reaction")
    .eq("message_id",messageId)
    .eq("user_id",usuario.id)
    .maybeSingle();

  if (existente.error) return erroSupabase(existente.error,"Consultar reação");

  if (existente.data?.reaction===emoji) {
    const {error} = await db.from("message_reactions").delete().eq("id",existente.data.id);
    if (error) return erroSupabase(error,"Remover reação");
  } else if (existente.data) {
    const {error} = await db.from("message_reactions").update({reaction:emoji}).eq("id",existente.data.id);
    if (error) return erroSupabase(error,"Alterar reação");
  } else {
    const {error} = await db.from("message_reactions").insert({
      message_id:messageId,user_id:usuario.id,reaction:emoji
    });
    if (error) return erroSupabase(error,"Enviar reação");
  }
  toast("Reação atualizada.");
}

function menuMensagem(messageId) {
  const m = mensagensAtuais.find(x=>x.id===messageId);
  if (!m) return;
  const proprio = m.sender_id===usuario.id;

  abrirModal(`
    <h2>Mensagem</h2>
    <button class="setting-row w-full text-left" onclick="copiarMensagem('${messageId}')">Copiar texto</button>
    <button class="setting-row w-full text-left" onclick="apagarMensagem('${messageId}')">Apagar para mim</button>
    ${proprio ? `<button class="setting-row w-full text-left" onclick="editarMensagem('${messageId}')">Editar mensagem</button>` : ""}
    <div class="modal-actions"><button class="btn secondary" onclick="fecharModal()">Fechar</button></div>
  `);
}

async function copiarMensagem(id) {
  const m = mensagensAtuais.find(x=>x.id===id);
  try {
    await navigator.clipboard.writeText(m?.content || "");
    toast("Texto copiado.");
  } catch(e) { toast("Não foi possível copiar."); }
  fecharModal();
}

async function apagarMensagem(id) {
  const {error} = await db.from("message_deletions").insert({
    message_id:id,user_id:usuario.id
  });
  if (error) return erroSupabase(error,"Apagar mensagem para você");
  fecharModal();
  await carregarMensagens();
}

async function editarMensagem(id) {
  const m = mensagensAtuais.find(x=>x.id===id);
  if (!m || m.message_type!=="text") return toast("Edição disponível apenas para texto.");

  abrirModal(`
    <h2>Editar mensagem</h2>
    <textarea id="textoEdicao">${escapeHTML(m.content || "")}</textarea>
    <div class="modal-actions">
      <button class="btn secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn" onclick="salvarEdicao('${id}')">Salvar</button>
    </div>
  `);
}

async function salvarEdicao(id) {
  const content = $("textoEdicao").value.trim();
  if (!content) return toast("A mensagem não pode ficar vazia.");

  const {data,error} = await db.rpc("nx_edit_message",{
    p_message_id:id,p_content:content
  });

  if (error) return erroSupabase(error,"Editar mensagem");
  if (!data) return toast("A mensagem não pôde ser editada.");

  fecharModal();
  await carregarMensagens();
  toast("Mensagem editada.");
}

async function marcarMensagensLidas() {
  if (!conversaAtual) return;
  const ids = mensagensAtuais.filter(m=>m.sender_id!==usuario.id).map(m=>m.id);
  for (const id of ids) {
    await db.rpc("nx_update_message_receipt",{p_message_id:id,p_status:"read"});
  }
}

async function assinarMensagens(conversationId) {
  if (canalMensagens) {
    await db.removeChannel(canalMensagens);
    canalMensagens = null;
  }

  canalMensagens = db.channel("nexus-messages-"+conversationId)
    .on("postgres_changes",{
      event:"INSERT",schema:"public",table:"messages",
      filter:"conversation_id=eq."+conversationId
    },payload=>{
      if (payload.new.sender_id===usuario.id) return;
      if (mensagensAtuais.some(m=>m.id===payload.new.id)) return;
      mensagensAtuais.push(payload.new);
      renderMensagens();
      marcarMensagensLidas();
      carregarConversas();
    })
    .subscribe();
}

function exigirConversa() {
  if (!conversaAtual) {
    toast("Abra uma conversa primeiro.");
    return false;
  }
  return true;
}

function fecharChat() {
  $("screen-chat").classList.remove("open");
  conversaAtual = null;
  mensagensAtuais = [];
  cancelarResposta();
  if (canalMensagens) {
    db.removeChannel(canalMensagens);
    canalMensagens = null;
  }
  renderConversas();
}

function abrirMenuChat() { $("menuChat").classList.toggle("show"); }
function abrirPerfilConversa() {
  $("menuChat").classList.remove("show");
  const id = conversaAtual?.outroPerfil?.id;
  if (!id) return toast("Perfil do grupo.");
  abrirPerfilContato(id);
}

function fixarConversa() {
  $("menuChat").classList.remove("show");
  toast("Fixação preparada.");
}

async function alternarSilenciar() {
  $("menuChat").classList.remove("show");
  toast("Silenciamento preparado.");
}

async function bloquearContato() {
  const id = conversaAtual?.outroPerfil?.id;
  if (!id) return toast("Não foi possível identificar o contato.");
  if (!confirm("Deseja bloquear este contato?")) return;

  const {error} = await db.from("blocks").insert({blocker_id:usuario.id,blocked_id:id});
  if (error) return erroSupabase(error,"Bloquear contato");
  fecharChat();
  await carregarConversas();
  toast("Contato bloqueado.");
}

function denunciarContato() {
  $("menuChat").classList.remove("show");
  abrirModal(`
    <h2>Denunciar</h2>
    <input id="motivoDenuncia" placeholder="Motivo da denúncia">
    <textarea id="descricaoDenuncia" placeholder="Descreva o ocorrido..."></textarea>
    <div class="modal-actions">
      <button class="btn secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn" onclick="enviarDenuncia()">Enviar</button>
    </div>
  `);
}

async function enviarDenuncia() {
  const motivo = $("motivoDenuncia").value.trim();
  const descricao = $("descricaoDenuncia").value.trim();
  if (!motivo) return toast("Informe o motivo.");

  const {error} = await db.from("reports").insert({
    reporter_id:usuario.id,
    reported_user_id:conversaAtual?.outroPerfil?.id || null,
    conversation_id:conversaAtual?.id || null,
    reason:motivo,
    description:descricao || null
  });

  if (error) return erroSupabase(error,"Enviar denúncia");
  fecharModal();
  toast("Denúncia enviada.");
}

function pesquisarNaConversa() {
  $("menuChat").classList.remove("show");
  abrirModal(`
    <h2>Pesquisar mensagens</h2>
    <input id="buscaChat" placeholder="Digite o que procura..." oninput="resultadoBuscaChat()">
    <div id="resultadoBuscaChat"></div>
    <div class="modal-actions"><button class="btn secondary" onclick="fecharModal()">Fechar</button></div>
  `);
}

function resultadoBuscaChat() {
  const q = $("buscaChat").value.toLowerCase();
  const el = $("resultadoBuscaChat");
  el.innerHTML = "";
  if (!q) return;

  mensagensAtuais.filter(m=>(m.content || "").toLowerCase().includes(q)).forEach(m=>{
    const p = document.createElement("p");
    p.className = "p-2 text-sm";
    p.textContent = m.content;
    el.append(p);
  });
}

async function mostrarMidias() {
  $("menuChat").classList.remove("show");
  if (!conversaAtual) return;

  const {data,error} = await db.from("message_attachments")
    .select("id,message_id,file_name,mime_type,object_path,bucket_name")
    .in("message_id",mensagensAtuais.map(m=>m.id));

  if (error) return erroSupabase(error,"Carregar mídias");

  abrirModal("<h2>Mídia e arquivos</h2><div id='listaMidias'></div><div class='modal