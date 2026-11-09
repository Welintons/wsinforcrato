async function carregarPerfilApp() {
  const {data, error} = await db.from("profiles")
    .select("id,username,full_name,phone,bio,avatar_url,cover_url,city,state,is_active")
    .eq("id", usuario.id)
    .maybeSingle();

  if (error) throw error;

  // Se o perfil não existir na tabela profiles, avisa e direciona/cria estrutura segura
  if (!data) {
    toast("Aviso: Seu perfil não está 100% completo.");
    
    // Objeto temporário para a interface não quebrar
    perfil = {
      id: usuario.id,
      full_name: "Usuário",
      username: "",
      phone: "",
      bio: "Complete seu perfil nas configurações.",
      is_active: true
    };

    // Abre o modal de onboarding imediatamente para o usuário preencher
    abrirOnboarding();
    renderPerfil();
    return;
  }

  if (!data.is_active) {
    await db.auth.signOut();
    throw new Error("Esta conta está desativada.");
  }

  perfil = data;

  // Se estiver incompleto, avisa e abre o onboarding
  if (!perfil.username || perfil.full_name === "Usuário") {
    toast("Complete as informações do seu perfil.");
    abrirOnboarding();
  }
  
  renderPerfil();
}
