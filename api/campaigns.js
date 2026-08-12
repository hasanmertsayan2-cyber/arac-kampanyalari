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
  return String(value ?? "")
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
      normalize(oldItem?.[field]) !==
      normalize(newItem?.[field])
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

async function writeGitHubJson(
  path,
  data,
  message,
  sha = null
) {
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
  const date = new Date(
    payload?.updatedAt || Date.now()
  );

  if (Number.isNaN(date.getTime())) {
    return new Date()
      .toISOString()
      .slice(0, 10);
  }

  return date
    .toISOString()
    .slice(0, 10);
}

async function archivePreviousData(previous) {
  if (!previous?.data?.campaigns?.length) {
    return;
  }

  const date = archiveDate(previous.data);
  const path = `${ARCHIVE_DIR}/${date}.json`;

  const existingArchive =
    await readGitHubJson(path);

  await writeGitHubJson(
    path,
    previous.data,
    `archive: kampanya verileri ${date}`,
    existingArchive?.sha || null
  );
}

function mergeCampaignHistory(
  newCampaigns,
  previousPayload
) {
  const now = new Date().toISOString();

  const previousCampaigns =
    Array.isArray(previousPayload?.campaigns)
      ? previousPayload.campaigns
      : [];

  const previousMap = new Map();

  for (const campaign of previousCampaigns) {
    previousMap.set(
      campaignKey(campaign),
      campaign
    );
  }

  return newCampaigns.map((campaign) => {
    const previous = previousMap.get(
      campaignKey(campaign)
    );

    if (!previous) {
      return {
        ...campaign,
        firstSeenAt: now,
        lastSeenAt: now,
        lastChangedAt: now,
      };
    }

    const changed = campaignChanged(
      previous,
      campaign
    );

    return {
      ...campaign,

      firstSeenAt:
        previous.firstSeenAt ||
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

function validateCampaign(item) {
  if (
    !item ||
    typeof item !== "object"
  ) {
    return false;
  }

  if (
    !item.brand ||
    !item.model ||
    !item.cat ||
    !item.headline
  ) {
    return false;
  }

  if (
    ![
      "indirim",
      "kredi",
      "takas",
    ].includes(item.cat)
  ) {
    return false;
  }

  return true;
}

function removeDuplicateCampaigns(
  campaigns
) {
  const seen = new Set();
  const result = [];

  for (const campaign of campaigns) {
    if (!validateCampaign(campaign)) {
      continue;
    }

    const key = [
      normalize(campaign.brand),
      normalize(campaign.model),
      normalize(campaign.cat),
      normalize(campaign.headline),
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(campaign);
  }

  return result;
}

async function fetchCampaignBatch(
  prompt,
  maxSearches
) {
  const apiKey =
    process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY Vercel Environment Variables içinde tanımlı değil."
    );
  }

  const response = await fetch(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
        "x-api-key": apiKey,
        "anthropic-version":
          "2023-06-01",
      },

      body: JSON.stringify({
        model: "claude-sonnet-5",

        max_tokens: 8000,

        thinking: {
          type: "disabled",
        },

        tools: [
          {
            type:
              "web_search_20250305",
            name: "web_search",
            max_uses: maxSearches,
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
    const errorText =
      await response.text();

    throw new Error(
      `Anthropic API hata: ${response.status} ${errorText}`
    );
  }

  const data =
    await response.json();

  if (
    data.stop_reason ===
    "max_tokens"
  ) {
    throw new Error(
      "Claude cevabı token sınırında yarıda kesildi."
    );
  }

  const text = (
    data.content || []
  )
    .filter(
      (block) =>
        block.type === "text"
    )
    .map(
      (block) => block.text
    )
    .join("\n")
    .replace(
      /```json|```/g,
      ""
    )
    .trim();

  const start =
    text.indexOf("[");

  const end =
    text.lastIndexOf("]");

  if (
    start === -1 ||
    end === -1
  ) {
    throw new Error(
      "Claude cevabından geçerli kampanya JSON'u çıkarılamadı."
    );
  }

  const campaigns =
    JSON.parse(
      text.slice(
        start,
        end + 1
      )
    );

  if (
    !Array.isArray(campaigns)
  ) {
    throw new Error(
      "Claude kampanya dizisi döndürmedi."
    );
  }

  return campaigns;
}

async function fetchCampaignsFromClaude() {
  const normalPrompt = `
Türkiye'de şu anda geçerli olan sıfır kilometre otomobil satış kampanyalarını kapsamlı şekilde araştır.

Bu sorguda özellikle standart ve yaygın otomobil markalarına odaklan:

Volkswagen, Skoda, Cupra,
Toyota, Honda, Hyundai, Kia, Nissan,
Renault, Dacia,
Peugeot, Citroen, Opel,
Ford, Fiat,
Chery, BYD, MG, Jaecoo, Omoda
ve Türkiye'de aktif satış yapan diğer standart otomobil markaları.

Mümkün olduğunca fazla markayı kontrol et.

Kampanya sayısına üst sınır koyma.

Öncelikli kaynaklar:

1. Markaların Türkiye resmi web siteleri
2. Resmi distribütör ve finansman sayfaları
3. Yetkili satıcı kampanyaları

Kampanya türleri:

- nakit indirim
- kredi / faiz kampanyası
- takas desteği

Eski, süresi bitmiş veya doğrulanamayan kampanyaları ekleme.

Aynı modelde birden fazla farklı kampanya varsa bunları ayrı ayrı listeleyebilirsin.

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

cat sadece:
"indirim"
"kredi"
"takas"

değerlerinden biri olabilir.

amount TL cinsinden anlamlı sayısal tutar varsa sayı,
yoksa null olsun.
`;

  const premiumPrompt = `
Türkiye'de şu anda geçerli olan sıfır kilometre LÜKS / PREMIUM otomobil kampanyalarını kapsamlı şekilde araştır.

Aşağıdaki markaları MUTLAKA AYRI AYRI kontrol et:

BMW
Mercedes-Benz
Audi
Volvo
Lexus
Porsche
Land Rover
Jaguar
Alfa Romeo

Bunlara ek olarak Türkiye'de aktif satış yapan başka premium veya lüks otomobil markalarında kampanya varsa onları da kontrol et.

ÇOK ÖNEMLİ KURAL:

Bu markalardan güncel ve doğrulanabilir herhangi bir kampanya bulursan sonuç listesine MUTLAKA ekle.

Premium markaları sonuç sayısını azaltmak amacıyla eleme.

Bir markada kampanya bulunmadığı sonucuna varmadan önce mümkünse:

1. Türkiye resmi web sitesini
2. Kampanyalar / fırsatlar sayfasını
3. Finansman sayfasını

kontrol et.

Öncelikli kaynaklar:

1. Markaların Türkiye resmi web siteleri
2. Markaların resmi finansman kuruluşları
3. Resmi distribütör sayfaları
4. Yetkili satıcı kampanyaları

Kampanya türleri:

- nakit indirim
- kredi / faiz kampanyası
- takas desteği
- özel finansman fırsatı

Eski, süresi bitmiş veya doğrulanamayan kampanyaları ekleme.

Aynı modelde farklı kampanyalar varsa ayrı kayıtlar oluşturabilirsin.

Sonucu SADECE geçerli bir JSON dizisi olarak döndür.

Markdown, açıklama veya kod bloğu kullanma.

Format:

[
  {
    "brand": "BMW",
    "model": "320i Sedan",
    "cat": "kredi",
    "headline": "Özel finansman kampanyası",
    "detail": "Kampanyanın kısa açıklaması",
    "until": "31 Ağustos 2026",
    "amount": 1000000
  }
]

cat sadece:
"indirim"
"kredi"
"takas"

değerlerinden biri olabilir.

Özel finansman kampanyalarını "kredi" kategorisine koy.

amount TL cinsinden anlamlı sayısal tutar varsa sayı,
yoksa null olsun.
`;

  const [
    normalCampaigns,
    premiumCampaigns,
  ] = await Promise.all([
    fetchCampaignBatch(
      normalPrompt,
      8
    ),

    fetchCampaignBatch(
      premiumPrompt,
      8
    ),
  ]);

  const campaigns =
    removeDuplicateCampaigns([
      ...normalCampaigns,
      ...premiumCampaigns,
    ]);

  if (campaigns.length < 10) {
    throw new Error(
      `Yalnızca ${campaigns.length} kampanya bulundu. ` +
        "Güvenlik nedeniyle mevcut veri değiştirilmedi."
    );
  }

  console.log(
    "KAMPANYA OZETI:",
    {
      normal:
        normalCampaigns.length,

      premium:
        premiumCampaigns.length,

      toplam:
        campaigns.length,
    }
  );

  return campaigns;
}

export default async function handler(
  req,
  res
) {
  const githubToken =
    process.env.GITHUB_TOKEN;

  const refreshSecret =
    process.env.REFRESH_SECRET;

  if (!githubToken) {
    res.status(500).json({
      error:
        "GITHUB_TOKEN Vercel Environment Variables içinde tanımlı değil.",
    });

    return;
  }

  const wantsRefresh =
    req.query?.refresh === "1";

  const providedKey =
    req.query?.key;

  if (!wantsRefresh) {
    try {
      const latest =
        await readGitHubJson(
          LATEST_PATH
        );

      if (!latest) {
        res
          .status(503)
          .json({
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
        error:
          "Kayıtlı kampanya verisi okunamadı.",

        detail:
          String(error),
      });

      return;
    }
  }

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
    const previous =
      await readGitHubJson(
        LATEST_PATH
      );

    const newCampaigns =
      await fetchCampaignsFromClaude();

    const campaigns =
      mergeCampaignHistory(
        newCampaigns,
        previous?.data || null
      );

    const payload = {
      campaigns,

      updatedAt:
        new Date().toISOString(),

      count:
        campaigns.length,
    };

    if (previous) {
      await archivePreviousData(
        previous
      );
    }

    await writeGitHubJson(
      LATEST_PATH,

      payload,

      `data: kampanyalari guncelle ${new Date()
        .toISOString()
        .slice(0, 10)}`,

      previous?.sha || null
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    res.status(200).json({
      ...payload,

      cached: false,

      saved: true,

      message:
        "Yeni kampanyalar başarıyla kalıcı olarak GitHub'a kaydedildi.",
    });
  } catch (error) {
    res.status(500).json({
      error:
        "Kampanyalar güncellenemedi. Eski kayıtlar korunuyor.",

      detail:
        String(error),
    });
  }
}
