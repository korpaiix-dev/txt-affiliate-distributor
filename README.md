# TXT Affiliate Distributor

แยกลิ้ง affiliate (sub_id แยกช่อง) + กระจายคลิปลง **Facebook / YouTube / TikTok** — โมดูลเสริมของ [TXT-Thai-Agent](https://github.com/tanthaistudio99-lab/TXT-Thai-Agent)

> ระบบผลิตคลิปหลักอยู่ที่ TXT-Thai-Agent อยู่แล้ว repo นี้ทำหน้าที่ **"ส่วนกระจาย"** อย่างเดียว คือหลังจากมีคลิปพร้อมโพสต์ 1 อัน → สร้างลิงก์ affiliate ที่ติดรหัสแยกช่อง (วัดได้ว่าเงินมาจากช่องไหน) แล้วโพสต์/ส่งต่อไปแต่ละแพลตฟอร์ม

---

## ระบบนี้ทำอะไร

```
คลิปพร้อมโพสต์ (จาก TXT-Thai-Agent)
        │  job = { clipId, productUrl, caption, videoPath, title }
        ▼
  [distributor]  ── ต่อ 1 job ทำ 3 อย่างต่อช่อง ──►
        │
        ├─ 1) สร้างลิงก์ Shopee + sub_id แยกช่าง  (fb / yt / tt คนละ sub_id)
        ├─ 2) แทน {{LINK}} ในแคปชั่นด้วยลิงก์จริงของช่องนั้น
        └─ 3) ส่งออก:
               • Facebook → โพสต์วิดีโอขึ้นเพจ (Graph API + Page token)
               • YouTube  → อัปโหลดคลิป (Data API v3 + OAuth)
               • TikTok   → เข้า "คิวฟาร์มมือถือ" ให้ทีมมาปักตะกร้ามือ
        ▼
  บันทึกทุกอย่างลง store (links / posts / postqueue) — ดึงซ้ำไม่บวม
```

**ทำไม TikTok ไม่โพสต์ตรง:** TikTok Content Posting API ผูกตะกร้า (affiliate basket) ไม่ได้ + ติด audit ระบบเลยส่ง TikTok เข้าคิว `postqueue` ให้ทีมฟาร์มมือถือหยิบไปโพสต์ + ปักตะกร้า TikTok Shop เอง

---

## ต่อกับ TXT-Thai-Agent ยังไง

หลัง TXT-Thai-Agent ผลิตคลิปเสร็จ (ได้ไฟล์วิดีโอ + แคปชั่น) ให้เรียก:

```js
const { makeDistributor } = require("txt-affiliate-distributor/src/distributor");
const store = require("txt-affiliate-distributor/src/store");

const distribute = makeDistributor({
  store,
  affiliateId: process.env.TXT_SHOPEE_AFFILIATE_ID, // เลข affiliate ของบอส
  channels: ["facebook", "youtube", "tiktok"],
  account: { facebook: "ชื่อเพจ", youtube: "ชื่อช่อง" },
  campaign: "julysale",
});

// job นี้เอามาจากผลลัพธ์ของ TXT-Thai-Agent (คลิป 1 อัน)
await distribute({
  clipId: "clip123",
  productUrl: "https://shopee.co.th/product/xxx/yyy", // ลิงก์สินค้า Shopee (ตัวจริง ยังไม่ต้องติด affiliate)
  videoPath: "/path/to/clip.mp4",
  title: "รีวิวสินค้า...",
  caption: "แคปชั่น... 👉 {{LINK}}\n#แฮชแท็ก",   // ใส่ {{LINK}} ตรงที่อยากให้ลิงก์ไปแทน
});
```

- `{{LINK}}` จะถูกแทนด้วยลิงก์ affiliate ของช่องนั้นอัตโนมัติ (คนละ sub_id)
- ผลลัพธ์ทั้งหมดถูกบันทึกใน store — งาน TikTok รออยู่ใน `postqueue` ให้ฝั่งฟาร์มมือถือมาหยิบ

---

## โครงไฟล์

```
src/
  link-factory.js        แยกลิ้ง: สร้างลิงก์ Shopee + sub_id แยกช่อง (หัวใจการวัดเงิน)
  distributor.js         ตัวหลัก: รับ job -> ลิงก์ -> โพสต์/เข้าคิว -> บันทึก
  store.js               เก็บ links / posts / postqueue (JSON, ย้ายเครื่องง่าย)
  channels/
    youtube.js           อัปโหลด YouTube (OAuth) + mock
    facebook.js          โพสต์เพจ Facebook (Page token) + mock
    tiktok.js            เข้าคิวฟาร์มมือถือ
examples/run-distribute.js   ตัวอย่างเรียกใช้ (รันได้เลยแบบ mock)
test/test-distributor.js     ชุดทดสอบ
.env.example              ตัวแปร/token ทั้งหมด (ก๊อปเป็น .env.local แล้วเติม)
```

---

## ติดตั้ง + รัน

ต้องมี **Node.js 22+** (ใช้ fetch/FormData ในตัว ไม่ต้องลง dependency)

```bash
# 1) โคลน
git clone https://github.com/korpaiix-dev/txt-affiliate-distributor.git
cd txt-affiliate-distributor

# 2) ทดสอบ (โหมด mock ไม่ต้องมี token) -> ต้องขึ้น PASS 8/8
npm test

# 3) ดูตัวอย่างการทำงาน
npm run example
```

---

## ตั้งค่า token (เพื่อนทำส่วนนี้)

ก๊อป `.env.example` เป็น `.env.local` แล้วเติมค่า จากนั้นโหลด env ตอนรัน เช่น:

```bash
cp .env.example .env.local
# แก้ค่าใน .env.local ...
node -r dotenv/config examples/run-distribute.js dotenv_config_path=.env.local
```

### YouTube (Data API v3 + OAuth)
1. [Google Cloud Console](https://console.cloud.google.com/) → สร้างโปรเจกต์ → เปิด **YouTube Data API v3**
2. สร้าง **OAuth client** (ประเภท Desktop) → ได้ `client_id` + `client_secret`
3. ทำ OAuth ครั้งเดียว (scope `youtube.upload`) เพื่อเก็บ `refresh_token`
4. ใส่ลง `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`

### Facebook (Graph API)
1. [developers.facebook.com](https://developers.facebook.com/) → สร้าง App
2. ขอ **Page Access Token** แบบ long-lived (สิทธิ์ `pages_manage_posts`, `pages_read_engagement`)
3. ใส่ลง `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`

> ยังไม่ใส่ token ก็รันได้ (เป็นโหมด **mock** = จำลองว่าโพสต์แล้ว) พอใส่ token ครบ ระบบจะโพสต์ของจริงทันที ไม่ต้องแก้โค้ด

### TikTok
ไม่ต้องใช้ token — ระบบส่งงานเข้า `postqueue` ให้ฝั่งฟาร์มมือถือมาปักตะกร้าเอง

---

## สถานะแต่ละช่อง

| ช่อง | ต้องใช้ token? | ไม่มี token |
|---|---|---|
| Facebook | Page Access Token | โหมด mock |
| YouTube | OAuth (refresh token) | โหมด mock |
| TikTok | ไม่ต้อง | เข้าคิวฟาร์มมือถือ |
| ลิงก์ sub_id + แยกช่อง | ไม่ต้อง | **ทำงานจริงเสมอ** |

---

## ความปลอดภัย
- **ห้าม commit `.env.local`** (มี token ลับ) — `.gitignore` กันไว้ให้แล้ว
- token เก็บใน `.env.local` ในเครื่องที่รันเท่านั้น

## License
MIT
