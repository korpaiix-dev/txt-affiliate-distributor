"use strict";

/**
 * TXT Link Factory (V2 add-on) — สร้างลิงก์ affiliate แยกช่องด้วย sub_id
 * -------------------------------------------------------------------
 * ไม่พึ่ง Shopee Open API (บอสเข้าไม่ได้). ใช้วิธี append sub_id ในลิงก์
 * affiliate ปกติ ซึ่ง Shopee รองรับอย่างเป็นทางการ:
 *
 *   https://s.shopee.co.th/an_redir?origin_link=<ENCODED product url>
 *          &affiliate_id=<AFFILIATE_ID>&sub_id=<v1>-<v2>-<v3>-<v4>-<v5>
 *
 * sub_id = 1 พารามิเตอร์ ใส่ได้สูงสุด 5 ค่า คั่นด้วย "-"
 *   v1 = channel   (fb / yt / sp)         ← รู้ว่ามาจากช่องไหน
 *   v2 = clipId    (โค้ดคลิป)              ← รู้ว่าคลิปไหนทำเงิน
 *   v3 = account   (บัญชี/เพจ)
 *   v4 = date      (YYYYMMDD)
 *   v5 = campaign  (ออปชั่น)
 *
 * ดึงรายได้กลับ: export CSV จาก Shopee Affiliate dashboard (Conversion Report
 * กรอง sub_id ได้) แล้ว parse map กลับเข้า revenue_events — ทำในเฟส dashboard.
 *
 * หมายเหตุ locked baseline: adapter นี้เป็นไฟล์ใหม่ ไม่แตะ flow ที่ล็อก.
 * ตัวที่ replace {{LINK}} → job.affiliateLink อยู่ใน android-bridge-adapter (locked)
 * เราแค่ป้อน job.affiliateLink ให้เป็นลิงก์ sub_id ที่ดีขึ้น ก่อน job ถึง adapter นั้น.
 */

const DEFAULT_SHOPEE_REDIRECT_BASE = "https://s.shopee.co.th/an_redir";

// รหัสช่องทางสั้น ๆ ที่จะฝังใน sub_id
const CHANNELS = {
  facebook: "fb",
  fb: "fb",
  youtube: "yt",
  yt: "yt",
  shopee: "sp",
  shopee_video: "sp",
  sp: "sp",
  tiktok: "tt", // TikTok ใช้ตะกร้า TikTok Shop ไม่ใช่ลิงก์ Shopee — ใส่ไว้เผื่อ mapping
  lazada: "lzd",
};

/** อ่าน affiliate_id จาก config/env — ยังไม่ต้องมีเลขจริงก็ทดสอบ flow ได้ */
function resolveAffiliateId(explicit) {
  const id =
    explicit ||
    process.env.TXT_SHOPEE_AFFILIATE_ID ||
    process.env.SHOPEE_AFFILIATE_ID ||
    "";
  return String(id).trim();
}

/** ทำให้ค่าหนึ่ง ๆ ปลอดภัยสำหรับ sub_id: a-z 0-9 เท่านั้น (ห้ามมี "-" เพราะเป็นตัวคั่น) */
function sanitizeSubIdValue(value, maxLen = 24) {
  return String(value == null ? "" : value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, maxLen);
}

function channelCode(channel) {
  const key = String(channel || "").toLowerCase();
  return CHANNELS[key] || sanitizeSubIdValue(key, 4) || "xx";
}

function todayYYYYMMDD(date) {
  const d = date ? new Date(date) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * ประกอบ sub_id string จากองค์ประกอบ (ตัดค่าท้ายที่ว่างออกแต่คงตำแหน่ง)
 * @returns {string} เช่น "fb-c10231-a1-20260704"
 */
function buildSubId({ channel, clipId, account, date, campaign } = {}) {
  const parts = [
    channelCode(channel),
    sanitizeSubIdValue(clipId, 24),
    sanitizeSubIdValue(account, 8),
    sanitizeSubIdValue(todayYYYYMMDD(date), 8),
    sanitizeSubIdValue(campaign, 12),
  ];
  while (parts.length && parts[parts.length - 1] === "") parts.pop();
  return parts.join("-");
}

/** สร้างลิงก์ affiliate Shopee พร้อม sub_id (encode origin_link ให้อัตโนมัติ) */
function buildShopeeAffiliateLink({ productUrl, affiliateId, subId, base } = {}) {
  const cleanUrl = String(productUrl || "").trim();
  if (!cleanUrl) throw new Error("link-factory: productUrl ว่าง");
  const params = new URLSearchParams();
  params.set("origin_link", cleanUrl);
  params.set("affiliate_id", resolveAffiliateId(affiliateId) || "AFFILIATE_ID_NOT_SET");
  if (subId) params.set("sub_id", subId);
  return `${base || DEFAULT_SHOPEE_REDIRECT_BASE}?${params.toString()}`;
}

/**
 * ฟังก์ชันหลัก: 1 สินค้า + 1 ช่อง + 1 คลิป → 1 ลิงก์ sub_id
 * @returns {{provider:string, channel:string, subId:string, shortUrl:string, productUrl:string, affiliateId:string}}
 */
function makeChannelLink({ productUrl, affiliateId, channel, clipId, account, date, campaign } = {}) {
  const aff = resolveAffiliateId(affiliateId);
  const subId = buildSubId({ channel, clipId, account, date, campaign });
  const shortUrl = buildShopeeAffiliateLink({ productUrl, affiliateId: aff, subId });
  return {
    provider: "shopee",
    channel: channelCode(channel),
    subId,
    shortUrl,
    productUrl: String(productUrl || "").trim(),
    affiliateId: aff || "AFFILIATE_ID_NOT_SET",
  };
}

/**
 * ดึง productUrl จาก job/product ตามคีย์ที่ repo ใช้อยู่ (ยืดหยุ่นหลายชื่อฟิลด์)
 */
function productUrlFromJob(job = {}, product = {}) {
  return String(
    job.sourceProductUrl ||
      job.productUrl ||
      product.shopeeUrl ||
      product.shopee_url ||
      product.productUrl ||
      product.url ||
      product.affiliateLink ||
      product.affiliate_link ||
      ""
  ).trim();
}

/**
 * helper สำหรับ integration: คืนค่า affiliateLink (ลิงก์ sub_id) ที่จะเซ็ตให้ job
 * ก่อนส่งเข้า flow เดิม — โค้ด locked จะ replace {{LINK}} ด้วยค่านี้เอง
 */
function affiliateLinkForJob(job = {}, product = {}, opts = {}) {
  const productUrl = productUrlFromJob(job, product);
  if (!productUrl) return "";
  const clipId = job.clipCode || job.videoCode || job.id || "";
  const link = makeChannelLink({
    productUrl,
    affiliateId: opts.affiliateId,
    channel: opts.channel || "sp",
    clipId,
    account: opts.account || "",
    campaign: opts.campaign || "",
  });
  return link.shortUrl;
}

/**
 * เก็บลงทะเบียนลิงก์ใน state (เลียนแบบ clipOnlyRecords) เพื่อ map sub_id → ช่อง/คลิป ทีหลัง
 */
function registerLink(state, entry = {}) {
  if (!state || typeof state !== "object") return entry;
  if (!Array.isArray(state.linkRegistry)) state.linkRegistry = [];
  const record = {
    id: `link_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    provider: entry.provider || "shopee",
    ...entry,
  };
  state.linkRegistry.push(record);
  return record;
}

/**
 * Lazada (แหล่งที่ 3, ยังเป็นโครง) — ปกติออกผ่าน Involve Asia deeplink + sub_id
 * ใส่ base deeplink ของบอสทีหลัง แล้ว append sub1..sub4
 */
function buildLazadaAffiliateLink({ productUrl, deeplinkBase, subId } = {}) {
  const cleanUrl = String(productUrl || "").trim();
  if (!cleanUrl) throw new Error("link-factory: productUrl ว่าง (lazada)");
  if (!deeplinkBase) return cleanUrl; // ยังไม่ตั้งค่า → คืน URL ตรง (TODO)
  const params = new URLSearchParams();
  params.set("url", cleanUrl);
  if (subId) params.set("sub_aff_id", subId);
  return `${deeplinkBase}?${params.toString()}`;
}

module.exports = {
  CHANNELS,
  channelCode,
  sanitizeSubIdValue,
  buildSubId,
  buildShopeeAffiliateLink,
  makeChannelLink,
  affiliateLinkForJob,
  productUrlFromJob,
  registerLink,
  buildLazadaAffiliateLink,
  resolveAffiliateId,
};
