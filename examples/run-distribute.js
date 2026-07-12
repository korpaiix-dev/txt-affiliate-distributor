"use strict";
// ตัวอย่างเรียกใช้ — ปกติ TXT-Thai-Agent จะส่ง job นี้มาให้หลังผลิตวิดีโอเสร็จ
// รัน: node examples/run-distribute.js   (ไม่มี token = โหมด mock อัตโนมัติ)
const store = require("../src/store");
const { makeDistributor } = require("../src/distributor");

(async () => {
  const distribute = makeDistributor({
    store,
    affiliateId: process.env.TXT_SHOPEE_AFFILIATE_ID || "15353120392",
    channels: ["facebook", "youtube", "tiktok"],
    account: { facebook: "page1", youtube: "chan1" },
    campaign: "demo",
  });
  const job = {
    clipId: "clipDEMO1",
    productUrl: "https://shopee.co.th/product/xxxx/yyyy",
    videoPath: "/path/to/clip.mp4",
    title: "รีวิวหูฟังบลูทูธกันน้ำ",
    caption: "หูฟังบลูทูธกันน้ำ เสียงดีมาก คุ้มสุด 👉 {{LINK}}\n#รีวิว #ของดีบอกต่อ",
  };
  const results = await distribute(job);
  console.log(JSON.stringify(results, null, 2));
  console.log("\nคิวฟาร์มมือถือ (รอปักตะกร้ามือ):", store.list("postqueue").length, "งาน");
})();
