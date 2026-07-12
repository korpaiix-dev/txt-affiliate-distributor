"use strict";
// TikTok channel adapter — TikTok ปักตะกร้าต้องทำมือ (Content Posting API ผูกตะกร้าไม่ได้)
// => เข้าคิว "ฟาร์มมือถือ" ให้ทีม/เพื่อนมาหยิบไปโพสต์ + ปักตะกร้า TikTok Shop เอง
function makeTikTokQueue(cfg = {}) {
  return function queue(job, store) {
    const id = "pf_" + (job.clipId || "") + "_tt";
    const rec = { id, kind: "phone_farm", channel: "tt", clip_id: job.clipId, product_url: job.productUrl, caption: job.caption, affiliate_url: job.affiliateUrl || "", video_path: job.videoPath, status: "pending_phonefarm" };
    if (store && store.upsert) store.upsert("postqueue", id, rec);
    return { provider: "phone_farm", id, status: "pending_phonefarm" };
  };
}
module.exports = { makeTikTokQueue };
