"use strict";
// TXT Affiliate Distributor — "ส่วนกระจาย"
// รับ job (คลิปพร้อมโพสต์ 1 อัน) -> สร้างลิงก์ affiliate sub_id แยกช่อง -> แทน {{LINK}}
//   -> โพสต์ FB/YT (ผ่าน token) / TikTok เข้าคิวฟาร์มมือถือ -> บันทึกลง store
// เรียกใช้จาก TXT-Thai-Agent หลังผลิตคลิปเสร็จ (ดู README หัวข้อ "ต่อกับ TXT-Thai-Agent")
const LF = require("./link-factory");
const { makeYouTube } = require("./channels/youtube");
const { makeFacebook } = require("./channels/facebook");
const { makeTikTokQueue } = require("./channels/tiktok");

function makeDistributor(opts = {}) {
  const youtube = opts.youtube || makeYouTube(opts.youtubeCfg || {});
  const facebook = opts.facebook || makeFacebook(opts.facebookCfg || {});
  const tiktokQueue = opts.tiktokQueue || makeTikTokQueue(opts.tiktokCfg || {});
  const store = opts.store || null;
  const channels = opts.channels || ["facebook", "youtube", "tiktok"];
  const affiliateId = opts.affiliateId;
  const account = opts.account || {};
  const campaign = opts.campaign || "";

  // job: { clipId, productUrl, caption ("...{{LINK}}"), videoPath, title? }
  return async function distribute(job) {
    const results = [];
    for (const ch of channels) {
      const code = LF.channelCode(ch);
      let affiliateUrl = "", subId = "";
      if (job.productUrl) {
        const link = LF.makeChannelLink({ productUrl: job.productUrl, affiliateId, channel: ch, clipId: job.clipId, account: account[ch] || "", campaign });
        affiliateUrl = link.shortUrl; subId = link.subId;
        if (store) store.addLink({ id: job.clipId + "_" + code, clip_id: job.clipId, channel: code, sub_id: subId, url: affiliateUrl, product_url: job.productUrl });
      }
      const caption = String(job.caption || "").replace(/\{\{LINK\}\}/g, affiliateUrl || "");
      let res;
      try {
        if (code === "yt") res = await youtube({ videoPath: job.videoPath, title: job.title || caption.split("\n")[0], description: caption });
        else if (code === "fb") res = await facebook({ videoPath: job.videoPath, message: caption });
        else if (code === "tt") res = tiktokQueue({ ...job, affiliateUrl, caption }, store);
        else res = { provider: code, status: "skipped" };
      } catch (e) { res = { provider: code, status: "failed", error: e.message }; }
      const rec = { id: "post_" + job.clipId + "_" + code, clip_id: job.clipId, channel: code, sub_id: subId, affiliate_url: affiliateUrl, caption, provider: res.provider, external_id: res.id || "", status: res.status, error: res.error || "" };
      if (store) store.upsert("posts", rec.id, rec);
      results.push(rec);
    }
    return results;
  };
}
module.exports = { makeDistributor };
