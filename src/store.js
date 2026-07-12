"use strict";

/**
 * TXT Data Store — ระบบเก็บข้อมูลกลาง (ย้ายเครื่องง่าย)
 * -----------------------------------------------------
 * เก็บ 2 แบบ:
 *   1) ข้อมูลตัวเลข/ข้อความ (products, clips, links, revenue) → ไฟล์ JSON ในโฟลเดอร์ data/
 *   2) ไฟล์วิดีโอคลิป → โฟลเดอร์ clips/
 *
 * ย้ายเครื่อง/เปลี่ยนที่เก็บ = เปลี่ยน "จุดเดียว" คือ env TXT_STORAGE_DIR
 *   - ตอนเทส: ปล่อยว่าง = ใช้โฟลเดอร์ปัจจุบัน (เช่น D:\งานshoppee\TXT-AI-Affiliate-Package)
 *   - ตอนใช้จริงบนเครื่องทีมงาน: set TXT_STORAGE_DIR=E:\txt-data (ฮาร์ดดิส) — เท่านั้น
 *
 * ไม่ใช้ไลบรารีนอก (รันได้ทุก Node) · upsert by id = ดึงซ้ำไม่บวม
 */

const fs = require("fs");
const path = require("path");

const BASE_DIR = process.env.TXT_STORAGE_DIR || process.cwd();
const CLIPS_DIR = path.join(BASE_DIR, "clips"); // ไฟล์วิดีโอ
const DATA_DIR = path.join(BASE_DIR, "data");   // ไฟล์ข้อมูล json

function ensureDirs() {
  for (const d of [CLIPS_DIR, DATA_DIR]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}
function tablePath(name) { return path.join(DATA_DIR, name + ".json"); }
function loadTable(name) { try { return JSON.parse(fs.readFileSync(tablePath(name), "utf8")); } catch { return {}; } }
function saveTable(name, obj) { ensureDirs(); fs.writeFileSync(tablePath(name), JSON.stringify(obj, null, 2)); }

/** upsert: เจอ id เดิม = อัปเดตทับ, ใหม่ = เพิ่ม (กันข้อมูลบวม) */
function upsert(name, id, record) {
  const t = loadTable(name);
  const key = String(id);
  t[key] = { ...(t[key] || {}), ...record, id: key, updated_at: new Date().toISOString() };
  saveTable(name, t);
  return t[key];
}
function list(name) { return Object.values(loadTable(name)); }
function get(name, id) { return loadTable(name)[String(id)] || null; }
function count(name) { return Object.keys(loadTable(name)).length; }

// ---- entities (4 อย่างที่ต้องเก็บ) ----
const addProduct = (p) => upsert("products", p.id, p);              // สินค้าที่ค้นมา
const addClip = (c) => upsert("clips", c.id, c);                    // คลิป (c.video_path ชี้ไฟล์ใน clips/)
const addLink = (l) => upsert("links", l.id || `${l.clip_id}_${l.channel}`, l); // ลิงก์ค่าคอมแยกช่อง
const addRevenue = (r) => upsert("revenue", r.order_id, r);         // ยอดขาย (key=order_id กันซ้ำ)

/** ที่อยู่ไฟล์วิดีโอของคลิป (ในโฟลเดอร์ clips/) */
function clipVideoPath(clipId, ext) { return path.join(CLIPS_DIR, String(clipId) + (ext || ".mp4")); }

/** สรุปรายได้แยกช่อง อ่านจากตาราง revenue (ตัดที่ยกเลิก) */
function revenueByChannel({ includeCancelled = false } = {}) {
  const rows = list("revenue");
  const out = {};
  for (const r of rows) {
    const st = String(r.status || "");
    if (!includeCancelled && /cancel|refund|invalid|ยกเลิก/i.test(st)) continue;
    const ch = r.channel || "unknown";
    if (!out[ch]) out[ch] = { channel: ch, orders: 0, gmv: 0, commission: 0 };
    out[ch].orders += 1;
    out[ch].gmv += Number(r.gmv || 0);
    out[ch].commission += Number(r.commission || 0);
  }
  return Object.values(out).sort((a, b) => b.commission - a.commission);
}

module.exports = {
  BASE_DIR, CLIPS_DIR, DATA_DIR, ensureDirs,
  upsert, list, get, count,
  addProduct, addClip, addLink, addRevenue,
  clipVideoPath, revenueByChannel,
};
