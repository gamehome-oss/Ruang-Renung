async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data));
  return [...new Uint8Array(s)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function same(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function onRequest({ request, env, next }) {
  const v = (request.headers.get("Cookie") || "").match(/rr_session=([^;]+)/)?.[1] || "";
  const [exp, sig] = v.split(".");
  if (exp && sig && Number(exp) > Date.now() && same(sig, await hmac(env.GITHUB_CLIENT_SECRET, "rr|" + exp))) {
    const res = await next();
    const out = new Response(res.body, res);
    out.headers.set("Cache-Control", "no-store");
    return out;
  }
  return Response.redirect(new URL("/api/auth?gate=1", request.url).toString(), 302);
}
