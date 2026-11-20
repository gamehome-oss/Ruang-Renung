async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data));
  return [...new Uint8Array(s)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  const saved = (request.headers.get("Cookie") || "").match(/rr_state=([^;]+)/)?.[1];
  const gate = state.startsWith("g.");
  const clear = "rr_state=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0";

  let ok = false, token = "";
  if (code && state && state === saved) {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "ruang-renung-cms" },
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
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "ruang-renung-cms" },
      });
      const login = u.ok ? ((await u.json()).login || "") : "";
      ok = !!login && login.toLowerCase() === (env.ALLOWED_GITHUB_USER || "").trim().toLowerCase();
    }
  }

  if (gate) {
    if (!ok) {
      return new Response("Halaman ini bersifat pribadi.", {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Set-Cookie": clear },
      });
    }
    const exp = String(Date.now() + 7 * 24 * 3600 * 1000);
    const sig = await hmac(env.GITHUB_CLIENT_SECRET, "rr|" + exp);
    const h = new Headers({ Location: "/admin/" });
    h.append("Set-Cookie", `rr_session=${exp}.${sig}; Path=/admin; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);
    h.append("Set-Cookie", clear);
    return new Response(null, { status: 302, headers: h });
  }

  const msg = ok
    ? `authorization:github:success:${JSON.stringify({ token, provider: "github" })}`
    : `authorization:github:error:${JSON.stringify({ message: "Login gagal atau akun tidak diizinkan." })}`;
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
