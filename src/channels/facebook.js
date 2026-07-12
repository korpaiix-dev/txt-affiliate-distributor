"use strict";
// Facebook channel adapter — โพสต์วิดีโอขึ้นเพจ ผ่าน Graph API (Page Access Token)
// เพื่อนเติม token เอง (ดู .env.example). ถ้าไม่มี token -> โหมด mock
const fs = require("fs");
function hasCreds(c) { return !!(c.pageId && c.accessToken); }
function makeFacebook(cfg = {}) {
  const c = {
    pageId: cfg.pageId || process.env.FB_PAGE_ID,
    accessToken: cfg.accessToken || process.env.FB_PAGE_ACCESS_TOKEN,
    apiVersion: cfg.apiVersion || process.env.FB_API_VERSION || "v19.0",
  };
  const fetchImpl = cfg.fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
  return async function postVideo({ videoPath, message }) {
    if (!hasCreds(c)) return { provider: "facebook-mock", id: "fb_mock_" + Math.random().toString(36).slice(2, 9), status: "mock_no_token", url: "" };
    if (!fetchImpl) throw new Error("no fetch");
    if (!videoPath || !fs.existsSync(videoPath)) throw new Error("Facebook: ไม่พบไฟล์วิดีโอ " + videoPath);
    const url = "https://graph.facebook.com/" + c.apiVersion + "/" + c.pageId + "/videos";
    const bytes = fs.readFileSync(videoPath);
    const form = new FormData();
    form.set("access_token", c.accessToken);
    form.set("description", message || "");
    form.set("source", new Blob([bytes], { type: "video/mp4" }), "clip.mp4");
    const res = await fetchImpl(url, { method: "POST", body: form });
    if (!res.ok) throw new Error("Facebook error " + res.status + " " + (await res.text().catch(() => "")));
    const d = await res.json();
    return { provider: "facebook", id: d.id || "", status: "posted", url: d.id ? "https://www.facebook.com/" + d.id : "" };
  };
}
module.exports = { makeFacebook, hasCreds };
