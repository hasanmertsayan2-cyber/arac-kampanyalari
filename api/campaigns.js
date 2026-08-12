const GITHUB_OWNER = "hasanmertsayan2-cyber";
const GITHUB_REPO = "arac-kampanyalari";
const GITHUB_BRANCH = "main";

const LATEST_PATH = "data/campaigns-latest.json";
const ARCHIVE_DIR = "data/archive";

function githubHeaders() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "arac-kampanyalari-vercel",
  };
}

function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ")
    .trim();
}

function campaignKey(item) {
  return [
    normalize(item.brand),
    normalize(item.model),
    normalize(item.cat),
  ].join("|");
}

function campaignChanged(oldItem, newItem) {
  const fields = ["headline", "detail", "until", "amount"];

  return fields.some(
    (field) =>
      normalize(oldItem?.[field]) !== normalize(newItem?.[field])
  );
}

async function readGitHubJson(path) {
  const url =
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}` +
    `/contents/${path}?ref=${GITHUB_BRANCH}`;

  const response = await fetch(url, {
    headers: githubHeaders(),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `GitHub okuma hatası: ${response.status} ${errorText}`
    );
  }

  const file = await response.json();

  const jsonText = Buffer.from(
    file.content.replace(/\n/g, ""),
    "base64"
  ).toString("utf8");

  return {
    sha: file.sha,
    data: JSON.parse(jsonText),
  };
}

async function writeGitHubJson(path, data, message, sha = null) {
  const url =
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}` +
    `/contents/${path}`;

  const body = {
    message,
    content: Buffer.from(
      JSON.stringify(data, null, 2),
      "utf8"
    ).toString("base64"),
    branch: GITHUB_BRANCH,
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      ...githubHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `GitHub yazma hatası (${path}): ${response.status} ${errorText}`
    );
  }

  return response.json();
}

function archiveDate(payload) {
  const date = new Date(payload?.updatedAt || Date.now());

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

async function archivePreviousData(previous) {
  if (!previous?.data?.campaigns?.length) {
    return;
  }

  const date = archiveDate(previous.data);
  const path = `${ARCHIVE_DIR}/${date}.json`;

  const existingArchive = await readGitHubJson(path);

  await writeGitHubJson(
    path,
    previous.data,
    `archive: kampanya verileri ${date}`,
    existingArchive?.sha || null
  );
}

function mergeCampaignHistory(newCampaigns, previousPayload) {
  const now = new Date().toISOString();

  const previousCampaigns = Array.isArray(previousPayload?.campaigns)
    ? previousPayload.campaigns
    : [];

  const previousMap = new Map();

  for (const campaign of previousCampaigns) {
    previousMap.set(campaignKey(campaign), campaign);
  }

  return newCampaigns.map((campaign) => {
    const previous = previousMap.get(campaignKey(campaign));

    if (!previous) {
      return {
        ...campaign,
        firstSeenAt: now,
        lastSeenAt: now,
        lastChangedAt: now,
      };
    }

    const changed = campaignChanged(previous, campaign);

    return {
      ...campaign,

      firstSeenAt:
        previous.firstSeenAt ||
        previous.updatedAt ||
        previousPayload?.updatedAt ||
        now,

      lastSeenAt: now,

      lastChangedAt: changed
        ? now
        : previous.lastChangedAt ||
          previous.firstSeenAt ||
          previousPayload?.updatedAt ||
          now,
    };
  });
}

async function fetchCampaignsFromClaude() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY Vercel Environment Variables içinde tanımlı değil."
    );
  }

  const prompt = `
Türkiye'de şu anda geçerli olan sıfır kilometre otomobil satış kampanyalarını web'de araştır.

Mümkün olduğunca farklı markalardan en az 15, en fazla 25 güncel kampanya bul.

Kampanyalar:
- nakit indirim
- kredi / faiz kampanyası
- takas desteği

olabilir.

Eski, süresi bitmiş veya doğrulanamayan kampanyaları ekleme.

Sonucu SADECE geçerli bir JSON dizisi olarak döndür.
Markdown, açıklama veya kod bloğu kullanma.

Format:

[
  {
    "brand": "Marka",
    "model": "Model",
    "cat": "indirim",
    "headline": "150.000 TL indirim",
    "detail": "Kampanyanın kısa açıklaması",
    "until": "31 Ağustos 2026",
    "amount": 150000
  }
]

cat sadece şu değerlerden biri olabilir:
"indirim"
"kredi"
"takas"

amount TL cinsinden anlamlı sayısal tutar varsa sayı,
yoksa null olsun.
`;

  const response = await fetch(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 8000,

        thinking: {
          type: "disabled",
        },

        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 3,
          },
        ],

        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Anthropic API hata: ${response.status} ${errorText}`
    );
  }

  const data = await response.json();

  if (data.stop_reason === "max_tokens") {
    throw new Error(
      "Claude cevabı token sınırında yarıda kesildi."
    );
  }

  const text = (data.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .replace(/```json|```/g, "")
    .trim();

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");

  if (start === -1 || end === -1) {
    throw new Error(
      "Claude cevabından geçerli kampanya JSON'u çıkarılamadı."
    );
  }

  const campaigns = JSON.parse(
    text.slice(start, end + 1)
  );

  if (!Array.isArray(campaigns)) {
    throw new Error("Claude kampanya dizisi döndürmedi.");
  }

  /*
   * Çok az veri geldiyse eski kampanyaları ASLA silme.
   * Böylece Claude/API sorununda mevcut site korunur.
   */
  if (campaigns.length < 10) {
    throw new Error(
      `Yalnızca ${campaigns.length} kampanya bulundu. ` +
        "Güvenlik nedeniyle mevcut veri değiştirilmedi."
    );
  }

  return campaigns;
}

export default async function handler(req, res) {
  const githubToken = process.env.GITHUB_TOKEN;
  const refreshSecret = process.env.REFRESH_SECRET;

  if (!githubToken) {
    res.status(500).json({
      error:
        "GITHUB_TOKEN Vercel Environment Variables içinde tanımlı değil.",
    });
    return;
  }

  const wantsRefresh = req.query?.refresh === "1";
  const providedKey = req.query?.key;

  /*
   * Normal ziyaretçiler sadece kayıtlı veriyi okur.
   * Anthropic API çağrısı yapılmaz.
   */
  if (!wantsRefresh) {
    try {
      const latest = await readGitHubJson(LATEST_PATH);

      if (!latest) {
        res.status(503).json({
          error:
            "Henüz kalıcı kampanya verisi oluşturulmadı. " +
            "Site sahibi ilk yenilemeyi yapmalıdır.",
        });
        return;
      }

      res.setHeader(
        "Cache-Control",
        "public, s-maxage=60, stale-while-revalidate=300"
      );

      res.status(200).json({
        ...latest.data,
        cached: true,
      });

      return;
    } catch (error) {
      res.status(500).json({
        error: "Kayıtlı kampanya verisi okunamadı.",
        detail: String(error),
      });
      return;
    }
  }

  /*
   * Manuel refresh yalnızca gizli REFRESH_SECRET ile yapılabilir.
   */
  if (
    !refreshSecret ||
    providedKey !== refreshSecret
  ) {
    res.status(401).json({
      error:
        "Yetkisiz yenileme isteği. Doğru anahtar gerekli.",
    });
    return;
  }

  try {
    /*
     * Önce eski veriyi oku.
     * Yeni veri başarıyla oluşmadan eski veri değişmez.
     */
    const previous = await readGitHubJson(LATEST_PATH);

    /*
     * Claude + web search ile yeni veriyi çek.
     */
    const newCampaigns =
      await fetchCampaignsFromClaude();

    /*
     * firstSeenAt / lastChangedAt geçmişini koru.
     */
    const campaigns = mergeCampaignHistory(
      newCampaigns,
      previous?.data || null
    );

    const payload = {
      campaigns,
      updatedAt: new Date().toISOString(),
      count: campaigns.length,
    };

    /*
     * Eski latest dosyasını günlük arşive kaydet.
     */
    if (previous) {
      await archivePreviousData(previous);
    }

    /*
     * Yeni veri tamamen hazır olduktan sonra latest dosyasını değiştir.
     */
    await writeGitHubJson(
      LATEST_PATH,
      payload,
      `data: kampanyalari guncelle ${new Date()
        .toISOString()
        .slice(0, 10)}`,
      previous?.sha || null
    );

    res.setHeader("Cache-Control", "no-store");

    res.status(200).json({
      ...payload,
      cached: false,
      saved: true,
      message:
        "Yeni kampanyalar başarıyla kalıcı olarak GitHub'a kaydedildi.",
    });
  } catch (error) {
    /*
     * Herhangi bir hata olursa eski latest dosyasına dokunulmaz.
     */
    res.status(500).json({
      error:
        "Kampanyalar güncellenemedi. Eski kayıtlar korunuyor.",
      detail: String(error),
    });
  }
}
