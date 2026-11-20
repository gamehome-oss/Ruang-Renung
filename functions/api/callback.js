// Menukar kode dari GitHub menjadi token, memastikan akunnya adalah pemilik,
// lalu mengirim token ke halaman situs. Akun lain ditolak di sini.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const saved = (request.headers.get("Cookie") || "").match(/rr_state=([^;]+)/)?.[1];
  const clear = "rr_state=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0";

  let ok = false, token = "";
  if (code && state && state === saved) {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "ruang-renung" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${url.origin}/api/callback`,
      }),
    });
    token = (await res.json()).access_token || "";
    if (token) {
      const u = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "ruang-renung" },
      });
      const login = u.ok ? ((await u.json()).login || "") : "";
      ok = !!login && login.toLowerCase() === (env.ALLOWED_GITHUB_USER || "").trim().toLowerCase();
    }
  }

  const msg = ok
    ? `authorization:github:success:${JSON.stringify({ token, provider: "github" })}`
    : `authorization:github:error:${JSON.stringify({ message: "Akun ini tidak diizinkan masuk." })}`;
  const safe = v => JSON.stringify(v).replace(/</g, "\\u003c");
  const html = `<!doctype html><meta charset="utf-8"><title>Masuk</title><p>Menyelesaikan login...</p>
<script>
(function () {
  var m = ${safe(msg)}, o = ${safe(url.origin)};
  window.addEventListener("message", function (e) {
    if (e.origin !== o) return;
    window.opener.postMessage(m, o);
    window.close();
  });
  if (window.opener) window.opener.postMessage("authorizing:github", o);
})();
</script>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Set-Cookie": clear },
  });
}
