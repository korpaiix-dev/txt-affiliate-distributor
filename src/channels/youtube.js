"use strict";
// YouTube channel adapter — อัปโหลดคลิปขึ้น YouTube ผ่าน Data API v3 (OAuth refresh token)
// เพื่อนเติม token เอง (ดู .env.example). ถ้าไม่มี token -> โหมด mock (ไว้เทส)
const fs = require("fs");
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";

function hasCreds(c) { return !!(c.accessToken || (c.clientId && c.clientSecret && c.refreshToken)); }

async function getAccessToken(c, fetchImpl) {
  if (c.accessToken) return c.accessToken;
  const body = new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, refresh_token: c.refreshToken, grant_type: "refresh_token" });
  const res = await fetchImpl(TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  if (!res.ok) throw new Error("YouTube token error " + res.status + " " + (await res.text().catch(() => "")));
  return (await res.json()).access_token;
}

function makeYouTube(cfg = {}) {
  const c = {
    clientId: cfg.clientId || process.env.YT_CLIENT_ID,
    clientSecret: cfg.clientSecret || process.env.YT_CLIENT_SECRET,
    refreshToken: cfg.refreshToken || process.env.YT_REFRESH_TOKEN,
    accessToken: cfg.accessToken || process.env.YT_ACCESS_TOKEN,
    privacyStatus: cfg.privacyStatus || process.env.YT_PRIVACY || "public",
  };
  const fetchImpl = cfg.fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
  return async function upload({ videoPath, title, description }) {
    if (!hasCreds(c)) return { provider: "youtube-mock", id: "yt_mock_" + Math.random().toString(36).slice(2, 9), status: "mock_no_token", url: "" };
    if (!fetchImpl) throw new Error("no fetch");
    if (!videoPath || !fs.existsSync(videoPath)) throw new Error("YouTube: ไม่พบไฟล์วิดีโอ " + videoPath);
    const token = await getAccessToken(c, fetchImpl);
    const bytes = fs.readFileSync(videoPath);
    const meta = { snippet: { title: String(title || "clip").slice(0, 100), description: description || "" }, status: { privacyStatus: c.privacyStatus } };
    const init = await fetchImpl(UPLOAD_URL, { method: "POST", headers: { Authorization: "Bearer " + token, "content-type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "video/*", "X-Upload-Content-Length": String(bytes.length) }, body: JSON.stringify(meta) });
    if (!init.ok) throw new Error("YouTube init error " + init.status + " " + (await init.text().catch(() => "")));
    const uploadUrl = init.headers.get("location");
    if (!uploadUrl) throw new Error("YouTube: ไม่ได้ upload URL");
    const put = await fetchImpl(uploadUrl, { method: "PUT", headers: { "content-type": "video/*" }, body: bytes });
    if (!put.ok) throw new Error("YouTube upload error " + put.status + " " + (await put.text().catch(() => "")));
    const d = await put.json();
    return { provider: "youtube", id: d.id || "", status: "posted", url: d.id ? "https://youtu.be/" + d.id : "" };
  };
}
module.exports = { makeYouTube, getAccessToken, hasCreds };
