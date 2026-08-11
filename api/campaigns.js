// Bu dosya Vercel'de otomatik olarak /api/campaigns adresinde çalışan
// bir sunucu fonksiyonudur (serverless function). Tarayıcı bu adrese
// istek attığında, Claude'a "güncel kampanyaları web'de ara" görevini
// verir ve sonucu düzenli bir JSON olarak tarayıcıya geri döner.
//
// API anahtarı burada DOĞRUDAN yazılmaz; Vercel'in Environment Variables
// bölümünden ANTHROPIC_API_KEY adıyla eklenmesi gerekir.

// Basit bellek-içi önbellek: her istekte yeni sorgu atmamak için
// (maliyeti düşürür, siteyi hızlandırır). Vercel'in serverless yapısı
// nedeniyle bu önbellek fonksiyon "soğukken" sıfırlanabilir; kalıcı bir
// önbellek istersen Vercel KV / Upstash Redis gibi bir servis eklenebilir.
let cache = { data: null, timestamp: 0 };
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 saat - sen zaten her sabah elle tetikleyeceksin

export default async function handler(req, res) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const refreshSecret = process.env.REFRESH_SECRET;

  if (!apiKey) {
    res.status(500).json({
      error: "ANTHROPIC_API_KEY tanımlı değil. Vercel proje ayarlarından Environment Variables bölümüne eklemeyi unutma.",
    });
    return;
  }

  const wantsRefresh = req.query?.refresh === "1";
  const providedKey = req.query?.key;

  // Zorla yenileme isteği geldiyse, gizli anahtar doğru değilse reddet.
  // Bu sayede siteyi ziyaret eden rastgele biri "refresh=1" ekleyerek
  // sana ücret çıkartamaz - sadece bu URL'yi bilen (yani sen) tetikleyebilir.
  if (wantsRefresh && (!refreshSecret || providedKey !== refreshSecret)) {
    res.status(401).json({ error: "Yetkisiz yenileme isteği. Doğru anahtar gerekli." });
    return;
  }

  const forceRefresh = wantsRefresh; // artık buraya geldiyse yetkilendirilmiş demektir
  const now = Date.now();

  if (!forceRefresh && cache.data && now - cache.timestamp < CACHE_TTL_MS) {
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json({ ...cache.data, cached: true });
    return;
  }

  try {
    const prompt = `Türkiye'de bu ay geçerli olan sıfır kilometre otomobil satış kampanyalarını web'de araştır.
En az 15, en fazla 25 tane, mümkün olduğunca farklı markalardan kampanya bul (nakit indirim, kredi/faiz kampanyası, takas desteği gibi).
Sonucu SADECE aşağıdaki JSON dizisi formatında ver. Açıklama, markdown işareti (backtick), başlık ya da başka hiçbir metin ekleme, cevabın tamamı geçerli bir JSON dizisi olsun:

[
  {
    "brand": "Marka adı",
    "model": "Model adı",
    "cat": "indirim" | "kredi" | "takas",
    "headline": "Kısa ve çarpıcı özet, örn. '150.000 TL indirim' veya '12 ay %0,99 faiz'",
    "detail": "Bir cümlelik ek açıklama",
    "until": "Geçerlilik tarihi ya da 'Ağustos 2026' gibi bir ifade",
    "amount": sayısal_TL_tutarı_varsa_yoksa_null
  }
]`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 4000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API hata: ${response.status} ${errText}`);
    }

    const data = await response.json();
    console.log("CLAUDE DEBUG:", {
  stop_reason: data.stop_reason,
  contentTypes: (data.content || []).map((b) => b.type),
  textLength: (data.content || [])
    .filter((b) => b.type === "text")
    .reduce((total, b) => total + (b.text?.length || 0), 0),
});

    const textBlocks = (data.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const cleaned = textBlocks.replace(/```json|```/g, "").trim();
    const jsonStart = cleaned.indexOf("[");
    const jsonEnd = cleaned.lastIndexOf("]");

    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("Claude'un cevabından geçerli bir JSON dizisi çıkarılamadı.");
    }

    const jsonStr = cleaned.slice(jsonStart, jsonEnd + 1);
    const campaigns = JSON.parse(jsonStr);

    const payload = {
      campaigns,
      updatedAt: new Date().toISOString(),
    };

    cache = { data: payload, timestamp: now };

    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json({ ...payload, cached: false });
  } catch (err) {
    res.status(500).json({
      error: "Kampanya verisi alınamadı.",
      detail: String(err),
    });
  }
}
