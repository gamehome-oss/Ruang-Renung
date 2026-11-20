/* Editor Ruang Renung. Dimuat hanya setelah pemilik masuk. */
(function () {
  // GANTI dengan akun dan nama repositori GitHub-mu, contoh: "budi/ruang-renung"
  const REPO = "GANTI-USERNAME/GANTI-NAMA-REPOSITORI";
  const BRANCH = "main";
  const FILE = "data/essays.json";
  const API = "https://api.github.com/repos/" + REPO + "/contents/" + FILE;
  const DRAFT = "rr_draft";

  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const smart = s => s.replace(/(^|[\s(\[{\u2014\u2013-])"/g, "$1\u201C").replace(/"/g, "\u201D").replace(/'/g, "\u2019");
  const token = () => { try { return localStorage.getItem("rr_token") || ""; } catch (e) { return ""; } };
  const b64d = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, "")), c => c.charCodeAt(0)));
  const b64e = s => {
    const b = new TextEncoder().encode(s); let t = "";
    for (let i = 0; i < b.length; i += 8192) t += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
    return btoa(t);
  };
  const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

  const style = document.createElement("style");
  style.textContent = `
.ed{max-width:680px}
.ed h1{font-family:var(--serif);font-weight:500;font-size:clamp(2rem,6vw,2.8rem);line-height:1.1;margin:0 0 8px}
.ed .sub{color:var(--muted);margin:0 0 32px;font-size:.95rem}
.ed label{display:block;font-size:.9rem;font-weight:500;margin:22px 0 6px}
.ed .hint{font-weight:400;color:var(--muted)}
.ed input,.ed textarea{width:100%;font:inherit;color:var(--ink);background:transparent;border:1px solid var(--line);border-radius:10px;padding:10px 14px}
.ed textarea{resize:vertical;min-height:90px;line-height:1.7}
.ed #ed-body{min-height:360px;font-family:var(--serif);font-size:1.15rem;line-height:1.8}
.ed .row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media (max-width:600px){.ed .row{grid-template-columns:1fr}}
.ed .stat{font-size:.85rem;color:var(--muted);margin-top:6px}
.ed .actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:32px}
.ed button{font:inherit;font-size:.95rem;color:var(--bg);background:var(--ink);border:0;border-radius:999px;padding:10px 24px;cursor:pointer}
.ed button.ghost{background:none;color:var(--muted);border:1px solid var(--line)}
.ed button:disabled{opacity:.5;cursor:default}
.ed #ed-msg{font-size:.9rem;color:var(--accent)}
.ed-toast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:10px 20px;border-radius:999px;font-size:.9rem;z-index:10;max-width:90vw;text-align:center}`;
  document.head.appendChild(style);

  function toast(t) {
    const el = document.createElement("div");
    el.className = "ed-toast"; el.setAttribute("role", "status"); el.textContent = t;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 7000);
  }

  /* ---------- GitHub ---------- */
  function logout() {
    try { localStorage.removeItem("rr_token"); } catch (e) {}
    decorate();
    if (/^#(tulis|sunting-)/.test(location.hash)) location.hash = "";
  }

  async function gh(method, body) {
    if (REPO.startsWith("GANTI")) throw new Error("Nama repositori belum diisi di editor.js.");
    const headers = { Authorization: "Bearer " + token(), Accept: "application/vnd.github+json" };
    if (body) headers["Content-Type"] = "application/json";
    const url = method === "GET" ? API + "?ref=" + BRANCH + "&t=" + Date.now() : API;
    const r = await fetch(url, { method, headers, body: body && JSON.stringify(body) });
    if (r.status === 401) { logout(); throw new Error("Sesi berakhir. Silakan masuk lagi."); }
    if (!r.ok) {
      const m = { 403: "GitHub menolak izin. Pastikan akunmu pemilik repositori.", 404: "Repositori atau file tidak ditemukan. Periksa nama repositori di editor.js.", 409: "Data berubah di GitHub. Coba simpan lagi.", 422: "Data berubah di GitHub. Coba simpan lagi." };
      throw new Error(m[r.status] || "Gagal menyimpan (kode " + r.status + ").");
    }
    return r.json();
  }

  async function commit(mutate, message) {
    const j = await gh("GET");
    const data = JSON.parse(b64d(j.content));
    data.essays = data.essays || [];
    mutate(data.essays);
    await gh("PUT", { message, content: b64e(JSON.stringify(data, null, 2) + "\n"), sha: j.sha, branch: BRANCH });
    window.applyData(data);
  }

  const guard = cur => list => {
    const o = list[cur._i];
    if (!o || o.title !== cur._t) throw new Error("Tulisan ini sudah berubah di GitHub. Muat ulang halaman lalu coba lagi.");
  };

  /* ---------- Login ---------- */
  function popup() {
    return new Promise((resolve, reject) => {
      const w = window.open("/api/auth", "rr_login", "width=620,height=720");
      if (!w) return reject(new Error("Jendela login diblokir browser. Izinkan pop-up lalu coba lagi."));
      function on(e) {
        if (e.origin !== location.origin) return;
        if (e.data === "authorizing:github") { e.source.postMessage("authorizing:github", location.origin); return; }
        const m = /^authorization:github:(success|error):([\s\S]*)$/.exec(String(e.data));
        if (!m) return;
        window.removeEventListener("message", on);
        let p = {}; try { p = JSON.parse(m[2]); } catch (x) {}
        m[1] === "success" && p.token ? resolve(p.token) : reject(new Error(p.message || "Login gagal."));
      }
      window.addEventListener("message", on);
    });
  }

  async function login() {
    try {
      const t = await popup();
      try { localStorage.setItem("rr_token", t); } catch (e) {}
      decorate();
      toast("Berhasil masuk.");
    } catch (e) { toast(e.message || "Login gagal."); }
  }

  /* ---------- Tautan di halaman ---------- */
  function decorate() {
    const on = !!token();
    document.querySelectorAll(".owner").forEach(el => {
      el.innerHTML = on ? '<a href="#tulis">Tulis esai</a><a href="#" data-logout>Keluar</a>' : '<a href="#" data-login>Masuk</a>';
    });
    document.querySelectorAll(".owner-edit").forEach(el => {
      el.innerHTML = on ? '<a href="#sunting-' + esc(el.dataset.id) + '">Ubah tulisan ini</a>' : "";
    });
  }

  /* ---------- Formulir ---------- */
  const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT)); } catch (e) { return null; } };
  const values = () => ({
    title: smart($("#ed-title").value.trim()),
    topic: $("#ed-topic").value.trim(),
    date: $("#ed-date").value,
    excerpt: smart($("#ed-excerpt").value.trim()),
    body: $("#ed-body").value.split(/\n+/).map(p => smart(p.trim())).filter(Boolean).join("\n\n"),
    note: smart($("#ed-note").value.trim())
  });
  const go = () => { if (location.hash) location.hash = ""; else route(); };

  function open(route) {
    const app = $("#app");
    const cur = route.startsWith("sunting-") ? ESSAYS.find(e => e.id === route.slice(8)) : null;
    if (route !== "tulis" && !cur) return go();
    const d = cur
      ? { title: cur.title, topic: cur.topic, date: cur.date, excerpt: cur.excerpt || "", body: cur.body.join("\n\n"), note: cur.note || "" }
      : (readDraft() || { title: "", topic: "Refleksi", date: today(), excerpt: "", body: "", note: "" });
    const topics = [...new Set(["Refleksi", "Ekonomi", "Manajemen", ...ESSAYS.map(e => e.topic)])];

    app.innerHTML = `
      <div class="ed">
        <a class="back" href="#">Batal dan kembali</a>
        <h1>${cur ? "Ubah tulisan" : "Tulis esai baru"}</h1>
        <p class="sub">${cur ? "Perubahan akan disimpan ke GitHub." : "Tulisanmu tersimpan sebagai draf di browser ini sampai diterbitkan."}</p>
        <label for="ed-title">Judul</label>
        <input id="ed-title" type="text" autocomplete="off" value="${esc(d.title)}">
        <div class="row">
          <div><label for="ed-topic">Topik</label>
            <input id="ed-topic" list="ed-topics" type="text" autocomplete="off" value="${esc(d.topic)}">
            <datalist id="ed-topics">${topics.map(t => '<option value="' + esc(t) + '">').join("")}</datalist></div>
          <div><label for="ed-date">Tanggal</label><input id="ed-date" type="date" value="${esc(d.date)}"></div>
        </div>
        <label for="ed-excerpt">Kutipan singkat <span class="hint">(tampil di arsip; kosongkan agar dibuat otomatis)</span></label>
        <input id="ed-excerpt" type="text" autocomplete="off" value="${esc(d.excerpt)}">
        <label for="ed-body">Isi esai <span class="hint">(satu baris baru menjadi satu paragraf)</span></label>
        <textarea id="ed-body">${esc(d.body)}</textarea>
        <div class="stat" id="ed-stat"></div>
        <label for="ed-note">Catatan penulis <span class="hint">(opsional)</span></label>
        <textarea id="ed-note">${esc(d.note)}</textarea>
        <div class="actions">
          <button type="button" id="ed-save">${cur ? "Simpan perubahan" : "Terbitkan"}</button>
          ${cur ? '<button type="button" class="ghost" id="ed-del">Hapus tulisan</button>' : ""}
          <span id="ed-msg" role="status"></span>
        </div>
      </div>`;

    const stat = () => {
      const w = $("#ed-body").value.split(/\s+/).filter(Boolean).length;
      $("#ed-stat").textContent = w ? w + " kata, sekitar " + Math.max(1, Math.round(w / 200)) + " menit membaca" : "";
    };
    stat();
    ["title", "topic", "date", "excerpt", "body", "note"].forEach(k => $("#ed-" + k).addEventListener("input", () => {
      stat();
      if (!cur) { try { localStorage.setItem(DRAFT, JSON.stringify(values())); } catch (e) {} }
    }));

    const msg = t => { $("#ed-msg").textContent = t; };
    const busy = b => { document.querySelectorAll(".ed button").forEach(x => x.disabled = b); };

    $("#ed-save").addEventListener("click", async () => {
      const v = values();
      if (!v.title) return msg("Judul belum diisi.");
      if (!v.body) return msg("Isi esai belum ditulis.");
      if (!v.date) return msg("Tanggal belum diisi.");
      const item = { title: v.title, topic: v.topic || "Refleksi", date: v.date, ...(v.excerpt ? { excerpt: v.excerpt } : {}), body: v.body, ...(v.note ? { note: v.note } : {}) };
      busy(true); msg("Menyimpan ke GitHub...");
      try {
        await commit(list => { if (cur) { guard(cur)(list); list[cur._i] = item; } else list.unshift(item); }, (cur ? "Ubah esai: " : "Tambah esai: ") + item.title);
        if (!cur) { try { localStorage.removeItem(DRAFT); } catch (e) {} }
        toast("Tersimpan. Pembaca akan melihatnya dalam 1 sampai 2 menit.");
        go();
      } catch (e) { msg(e.message); busy(false); }
    });

    if (cur) $("#ed-del").addEventListener("click", async () => {
      if (!confirm("Hapus tulisan ini dari situs? Tindakan ini tidak bisa dibatalkan dari sini.")) return;
      busy(true); msg("Menghapus...");
      try {
        await commit(list => { guard(cur)(list); list.splice(cur._i, 1); }, "Hapus esai: " + cur.title);
        toast("Tulisan dihapus. Pembaca akan melihat perubahannya dalam 1 sampai 2 menit.");
        location.hash = "";
      } catch (e) { msg(e.message); busy(false); }
    });
    window.scrollTo(0, 0);
  }

  window.RR = { login, logout, decorate, open };
  decorate();
})();
