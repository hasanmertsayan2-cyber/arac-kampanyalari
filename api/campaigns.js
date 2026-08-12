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

function removeDuplicateCampaigns(campaigns) {
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
  batchName,
  prompt,
  maxSearches = 6
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

        max_tokens: 6000,

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
      `${batchName} Anthropic API hata: ${response.status} ${errorText}`
    );
  }

  const data =
    await response.json();

  if (
    data.stop_reason ===
    "max_tokens"
  ) {
    throw new Error(
      `${batchName} token sınırına ulaştı.`
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
      `${batchName} cevabından geçerli JSON çıkarılamadı.`
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
      `${batchName} kampanya dizisi döndürmedi.`
    );
  }

  return campaigns;
}

const COMMON_RULES = `
Yalnızca Türkiye'de şu anda geçerli sıfır kilometre otomobil kampanyalarını bul.

Öncelik sırası:
1. Markanın Türkiye resmi sitesi
2. Resmi finansman / distribütör sayfası
3. Yetkili satıcı

Eski, süresi bitmiş veya doğrulanamayan kampanyaları ekleme.

Kampanya türleri:
- nakit indirim
- kredi / faiz
- takas desteği
- özel finansman

Aynı modelde birbirinden farklı kampanyalar varsa ayrı kayıtlar oluşturabilirsin.

Her kampanyanın detail alanı en fazla 120 karakter olsun.
Headline kısa olsun.

Sonucu SADECE geçerli JSON dizisi olarak döndür.
Markdown veya açıklama yazma.

Format:

[
  {
    "brand": "Marka",
    "model": "Model",
    "cat": "indirim",
    "headline": "150.000 TL indirim",
    "detail": "Kısa kampanya açıklaması",
    "until": "31 Ağustos 2026",
    "amount": 150000
  }
]

cat yalnızca:
"indirim"
"kredi"
"takas"

olabilir.

Özel finansman kampanyalarını "kredi" kategorisine koy.

amount anlamlı TL tutarı varsa sayı,
yoksa null olsun.
`;

async function fetchCampaignsFromClaude() {
  const promptA = `
${COMMON_RULES}

Şu markaları ayrı ayrı kontrol et:

Volkswagen
Skoda
Cupra
Renault
Dacia
Peugeot
Citroen
Opel
Ford
Fiat
Toyota
Honda

Bu markalardan doğrulanabilir kampanya varsa mutlaka listeye ekle.
`;

  const promptB = `
${COMMON_RULES}

Şu markaları ayrı ayrı kontrol et:

Hyundai
Kia
Nissan
Chery
BYD
MG
Jaecoo
Omoda
Suzuki
Mazda
Subaru
Mitsubishi

Ayrıca Türkiye'de aktif satış yapan ve ilk grupta olmayan diğer yaygın markaları da kontrol et.

Bu markalardan doğrulanabilir kampanya varsa mutlaka listeye ekle.
`;

  const promptC = `
${COMMON_RULES}

LÜKS / PREMIUM markaları ayrı ayrı ve özellikle kontrol et:

BMW
Mercedes-Benz
Audi
Volvo
Lexus
Porsche
Land Rover
Jaguar
Alfa Romeo

Ayrıca Türkiye'de aktif satış yapan diğer premium / lüks markaları da kontrol et.

Bu markalardan güncel ve doğrulanabilir kampanya varsa MUTLAKA listeye ekle.

Premium markaları sonuç sayısını azaltmak amacıyla eleme.
`;

  const [
    groupA,
    groupB,
    groupC,
  ] = await Promise.all([
    fetchCampaignBatch(
      "GRUP_A",
      promptA,
      6
    ),

    fetchCampaignBatch(
      "GRUP_B",
      promptB,
      6
    ),

    fetchCampaignBatch(
      "PREMIUM",
      promptC,
      6
    ),
  ]);

  const campaigns =
    removeDuplicateCampaigns([
      ...groupA,
      ...groupB,
      ...groupC,
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
      grupA:
        groupA.length,

      grupB:
        groupB.length,

      premium:
        groupC.length,

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
