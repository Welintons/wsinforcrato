
async function carregarPerfilApp() {
  const { data, error } = await db.from("profiles")
    .select("id,username,full_name,phone,bio,avatar_url,cover_url,city,state,is_active")
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
