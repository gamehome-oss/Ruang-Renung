// Mengarahkan ke halaman izin GitHub.
// Jika repositorimu privat, ganti "public_repo" menjadi "repo".
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const gate = url.searchParams.get("gate") === "1";
  const state = (gate ? "g." : "d.") + crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${url.origin}/api/callback`,
    state,
  });
  if (!gate) params.set("scope", "public_repo");
  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://github.com/login/oauth/authorize?${params}`,
      "Set-Cookie": `rr_state=${state}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}
