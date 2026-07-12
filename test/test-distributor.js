"use strict";
const assert = require("assert");
const fs = require("fs");
process.env.TXT_STORAGE_DIR = process.env.TXT_STORAGE_DIR || "/tmp/txtdist_test";
process.env.TXT_SHOPEE_AFFILIATE_ID = process.env.TXT_SHOPEE_AFFILIATE_ID || "15353120392";
try { fs.rmSync(process.env.TXT_STORAGE_DIR, { recursive: true, force: true }); } catch (e) {}
const store = require("../src/store");
const LF = require("../src/link-factory");
const { makeDistributor } = require("../src/distributor");

(async () => {
  let pass = 0; const ok = (n) => { console.log("  ok - " + n); pass++; };

  const l = LF.makeChannelLink({ productUrl: "https://shopee.co.th/product/1/2", channel: "facebook", clipId: "c1", campaign: "x" });
  assert(/affiliate_id=15353120392/.test(l.shortUrl) && /sub_id=fb-/.test(l.shortUrl)); ok("link factory: fb sub_id + affiliate_id");

  const distribute = makeDistributor({ store, channels: ["facebook", "youtube", "tiktok"], account: { facebook: "p1", youtube: "c1" }, campaign: "demo" });
  const res = await distribute({ clipId: "clipT1", productUrl: "https://shopee.co.th/product/1/2", videoPath: "/tmp/none.mp4", caption: "buy now {{LINK}}" });
  assert(res.length === 3); ok("distribute -> 3 channels");
  assert(res.every((r) => !/\{\{LINK\}\}/.test(r.caption) && r.affiliate_url && r.caption.includes(r.affiliate_url))); ok("caption {{LINK}} replaced with real per-channel link");
  const fb = res.find((r) => r.channel === "fb"), yt = res.find((r) => r.channel === "yt"), tt = res.find((r) => r.channel === "tt");
  assert(fb.provider === "facebook-mock" && yt.provider === "youtube-mock"); ok("FB/YT -> mock adapter when no token");
  assert(tt.provider === "phone_farm" && tt.status === "pending_phonefarm"); ok("TikTok -> phone-farm queue");
  assert(store.list("postqueue").length === 1); ok("phone-farm queue recorded");
  assert(store.list("links").length === 3 && store.list("posts").length === 3); ok("links + posts recorded in store");
  assert(new Set(store.list("links").map((x) => x.sub_id)).size === 3); ok("distinct sub_id per channel");

  console.log("\nPASS " + pass + "/" + pass + " - distributor (mock) OK\n");
})().catch((e) => { console.error("FAIL:", e); process.exit(1); });
