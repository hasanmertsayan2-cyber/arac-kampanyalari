import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUTPUT_PATH = path.resolve("data/prices-latest.json");

const BRANDS = [
  {
    brand: "Toyota",
    home: "https://www.toyota.com.tr",
    directUrl: "https://turkiye.toyota.com.tr/middle/fiyat-listesi/"
  },
  {
    brand: "BMW",
    home: "https://www.bmw.com.tr",
    directUrl: "https://teknikoto.bmw.com.tr/fiyat-listesi"
  },
  { brand: "Mercedes-Benz", home: "https://www.mercedes-benz.com.tr" },
  { brand: "Audi", home: "https://www.audi.com.tr" },
  { brand: "Volkswagen", home: "https://binekarac.vw.com.tr" },
  { brand: "Škoda", home: "https://www.skoda.com.tr" },
  { brand: "Cupra", home: "https://www.cupraofficial.com.tr" },
  { brand: "Renault", home: "https://www.renault.com.tr" },
  { brand: "Dacia", home: "https://www.dacia.com.tr" },
  { brand: "Peugeot", home: "https://www.peugeot.com.tr" },
  { brand: "Citroën", home: "https://www.citroen.com.tr" },
  { brand: "Opel", home: "https://www.opel.com.tr" },
  { brand: "Ford", home: "https://www.ford.com.tr" },
  { brand: "Fiat", home: "https://www.fiat.com.tr" },
  { brand: "Hyundai", home: "https://www.hyundai.com/tr/tr" },
  { brand: "Kia", home: "https://www.kia.com/tr" },
  { brand: "Nissan", home: "https://www.nissan.com.tr" },
  { brand: "Honda", home: "https://www.honda.com.tr" },
  { brand: "Chery", home: "https://www.chery.com.tr" },
  { brand: "BYD", home: "https://www.bydauto.com.tr" },
  { brand: "MG", home: "https://www.mg-turkey.com" },
  { brand: "OMODA", home: "https://www.omodajaecoo.com.tr" },
  { brand: "JAECOO", home: "https://www.omodajaecoo.com.tr" },
  { brand: "Suzuki", home: "https://www.suzuki.com.tr" },
  { brand: "Volvo", home: "https://www.volvocars.com/tr" },
  { brand: "Lexus", home: "https://www.lexus.com.tr" },
  { brand: "Porsche", home: "https://www.porsche.com.tr" },
  { brand: "Land Rover", home: "https://www.landrover.com.tr" },
  { brand: "Jaguar", home: "https://www.jaguar.com.tr" },
  { brand: "Alfa Romeo", home: "https://www.alfaromeo.com.tr" },
  { brand: "Togg", home: "https://www.togg.com.tr" },
  { brand: "DS Automobiles", home: "https://www.dsautomobiles.com.tr" },
  { brand: "MINI", home: "https://www.mini.com.tr" },
  { brand: "Subaru", home: "https://www.subaru.com.tr" },
  { brand: "Mazda", home: "https://www.mazda.com.tr" },
  { brand: "Mitsubishi", home: "https://www.mitsubishi-motors.com.tr" },
  { brand: "KGM", home: "https://www.kgmmobility.com.tr" },
  { brand: "DFSK", home: "https://www.dfsk.com.tr" },
  { brand: "Skywell", home: "https://www.skywell.com.tr" },
  { brand: "Leapmotor", home: "https://www.leapmotor.net/tr" }
];

const INVALID_LABEL_PATTERNS = [
  /^liste\s*(fiyatı|fiyati)?$/i,
  /^kampanyalı\s*(fiyatı|fiyati)?/i,
  /^kampanya\s*fiyatı/i,
  /^ötv\s*muaf/i,
  /^özel\s*tüketim/i,
  /^anahtar\s*teslim/i,
  /^tavsiye\s*edilen/i,
  /^satış\s*fiyatı/i,
  /^fiyat\s*listesi/i,
  /^fiyatlar$/i,
  /^model$/i,
  /^versiyon$/i,
  /^donanım$/i,
  /^motor$/i
];

function normalizeText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeKey(value) {
  return normalizeText(value)
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}+.-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePrice(value) {
  if (!value) return null;

  const cleaned = String(value).replace(/[^\d]/g, "");
  if (!cleaned) return null;

  const number = Number(cleaned);

  if (
    !Number.isFinite(number) ||
    number < 500000 ||
    number > 100000000
  ) {
    return null;
  }

  return number;
}

function priceMatches(text) {
  const matches =
    String(text || "").match(
      /(?:\d{1,3}(?:[.\s]\d{3})+|\d{6,9})\s*(?:TL|₺)?/gi
    ) || [];

  return matches
    .map(parsePrice)
    .filter(Boolean);
}

function cleanLabel(value) {
  return normalizeText(value)
    .replace(
      /\b(?:tavsiye edilen|anahtar teslim|satış fiyatı|liste fiyatı|kampanyalı fiyat|fiyatlar)\b/gi,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isInvalidLabel(value) {
  const text = cleanLabel(value);

  if (!text) return true;

  if (text.length < 2 || text.length > 120) {
    return true;
  }

  if (INVALID_LABEL_PATTERNS.some(pattern => pattern.test(text))) {
    return true;
  }

  if (/^[\d\s.,₺TL%*-]+$/i.test(text)) {
    return true;
  }

  return false;
}

function looksLikeRealVersion(value) {
  const text = cleanLabel(value);

  if (isInvalidLabel(text)) {
    return false;
  }

  const normalized = normalizeKey(text);

  const technicalSignals = [
    "hybrid",
    "multidrive",
    "e-cvt",
    "cv",
    "hp",
    "dsg",
    "dct",
    "at",
    "mt",
    "4x4",
    "4x2",
    "awd",
    "fwd",
    "rwd",
    "electric",
    "elektrik",
    "comfort",
    "premium",
    "executive",
    "prestige",
    "dream",
    "vision",
    "flame",
    "passion",
    "style",
    "business",
    "gt",
    "line",
    "amg",
    "x-pack",
    "allure",
    "active",
    "shine",
    "ultimate",
    "long range",
    "standard range"
  ];

  if (
    technicalSignals.some(signal =>
      normalized.includes(signal)
    )
  ) {
    return true;
  }

  if (/\d/.test(text)) {
    return true;
  }

  return text.split(/\s+/).length >= 2;
}

function makeKey(item) {
  return [
    item.brand,
    item.model,
    item.version
  ]
    .map(normalizeKey)
    .join("|");
}

function recordScore(item) {
  let score = 0;

  if (item.model) score += 2;
  if (item.version && item.version !== "Standart") score += 2;
  if (item.campaignPrice) score += 2;

  if (
    item.listPrice &&
    item.campaignPrice &&
    item.listPrice >= item.campaignPrice
  ) {
    score += 2;
  }

  if (looksLikeRealVersion(item.version)) {
    score += 2;
  }

  return score;
}

function isValidRecord(item) {
  if (!item.brand || !item.model || !item.listPrice) {
    return false;
  }

  if (isInvalidLabel(item.model)) {
    return false;
  }

  if (
    item.version &&
    item.version !== "Standart" &&
    !looksLikeRealVersion(item.version)
  ) {
    return false;
  }

  if (
    item.campaignPrice &&
    item.campaignPrice > item.listPrice * 1.5
  ) {
    return false;
  }

  return true;
}

function dedupe(records) {
  const map = new Map();

  for (const item of records) {
    if (!isValidRecord(item)) {
      continue;
    }

    const key = makeKey(item);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, item);
      continue;
    }

    if (recordScore(item) > recordScore(existing)) {
      map.set(key, item);
    }
  }

  return [...map.values()];
}

async function readPrevious() {
  try {
    const raw = await fs.readFile(OUTPUT_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      updatedAt: null,
      prices: [],
      sources: {}
    };
  }
}

async function configurePage(page) {
  await page.setExtraHTTPHeaders({
    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8"
  });
}

async function discoverPriceUrls(page, brand) {
  const urls = [];

  if (brand.directUrl) {
    urls.push(brand.directUrl);
  }

  try {
    await page.goto(brand.home, {
      waitUntil: "domcontentloaded",
      timeout: 40000
    });

    await page.waitForTimeout(2500);

    const discovered = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a[href]"))
        .map(a => ({
          href: a.href,
          text: (a.innerText || a.textContent || "").trim()
        }));
    });

    const keywords = [
      "fiyat listesi",
      "fiyat-listesi",
      "fiyatlar",
      "fiyat",
      "price list",
      "prices"
    ];

    const scored = discovered
      .map(item => {
        const hay =
          `${item.text} ${item.href}`.toLocaleLowerCase("tr-TR");

        let score = 0;

        for (let i = 0; i < keywords.length; i++) {
          if (hay.includes(keywords[i])) {
            score += 100 - i * 10;
          }
        }

        if (hay.includes("kampanya")) {
          score -= 15;
        }

        return {
          ...item,
          score
        };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);

    for (const item of scored.slice(0, 5)) {
      urls.push(item.href);
    }
  } catch (error) {
    console.log(
      `[${brand.brand}] ana sayfa taraması başarısız:`,
      String(error)
    );
  }

  return Array.from(new Set(urls));
}

async function extractTables(page, brand, sourceUrl) {
  const rows = await page.evaluate(() => {

    function previousHeading(el) {
      let current = el;

      for (let level = 0; level < 6 && current; level++) {
        let sibling = current.previousElementSibling;

        while (sibling) {
          if (
            sibling.matches?.(
              "h1,h2,h3,h4,[class*='title'],[class*='model']"
            )
          ) {
            const value =
              (
                sibling.innerText ||
                sibling.textContent ||
                ""
              ).trim();

            if (value) {
              return value;
            }
          }

          const nested =
            sibling.querySelector?.("h1,h2,h3,h4");

          if (nested) {
            const value =
              (
                nested.innerText ||
                nested.textContent ||
                ""
              ).trim();

            if (value) {
              return value;
            }
          }

          sibling = sibling.previousElementSibling;
        }

        current = current.parentElement;
      }

      return "";
    }

    return Array.from(document.querySelectorAll("table"))
      .flatMap(table => {
        const heading = previousHeading(table);

        return Array.from(table.querySelectorAll("tr"))
          .map(row => ({
            heading,
            cells: Array.from(
              row.querySelectorAll("th,td")
            ).map(cell =>
              (
                cell.innerText ||
                cell.textContent ||
                ""
              ).trim()
            )
          }));
      });
  });

  const output = [];

  for (const row of rows) {
    if (!row.cells || row.cells.length < 2) {
      continue;
    }

    const prices = [];
    const textCells = [];

    for (const cell of row.cells) {
      const found = priceMatches(cell);

      if (found.length) {
        prices.push(...found);
      } else if (normalizeText(cell)) {
        textCells.push(normalizeText(cell));
      }
    }

    if (!prices.length) {
      continue;
    }

    let model = cleanLabel(row.heading);

    const validTextCells =
      textCells.filter(cell => !isInvalidLabel(cell));

    let version =
      cleanLabel(validTextCells.join(" "));

    if (!model && validTextCells.length) {
      model = cleanLabel(validTextCells[0]);

      version = cleanLabel(
        validTextCells
          .slice(1)
          .join(" ")
      );
    }

    if (isInvalidLabel(model)) {
      continue;
    }

    if (
      version &&
      version !== "Standart" &&
      !looksLikeRealVersion(version)
    ) {
      version = "Standart";
    }

    output.push({
      brand: brand.brand,
      model,
      version: version || "Standart",
      listPrice: prices[0] || null,
      campaignPrice:
        prices.length > 1 &&
        prices[1] <= prices[0]
          ? prices[1]
          : null,
      sourceUrl
    });
  }

  return output;
}

async function extractCards(page, brand, sourceUrl) {
  const blocks = await page.evaluate(() => {

    const selectors = [
      "article",
      "li",
      "[class*='price']",
      "[class*='model']",
      "[class*='vehicle']",
      "[class*='car']"
    ];

    const elements =
      Array.from(
        document.querySelectorAll(
          selectors.join(",")
        )
      );

    return elements
      .map(el => ({
        text:
          (
            el.innerText ||
            el.textContent ||
            ""
          ).trim()
      }))
      .filter(item => {
        const len = item.text.length;

        return (
          len >= 10 &&
          len <= 700 &&
          /(?:TL|₺|\d{1,3}(?:\.\d{3}){2,})/i
            .test(item.text)
        );
      })
      .slice(0, 500);
  });

  const output = [];

  for (const block of blocks) {
    const prices = priceMatches(block.text);

    if (!prices.length) {
      continue;
    }

    const lines =
      normalizeText(block.text)
        .split("\n")
        .map(normalizeText)
        .filter(Boolean);

    const labels =
      lines.filter(line =>
        !priceMatches(line).length &&
        !isInvalidLabel(line)
      );

    if (!labels.length) {
      continue;
    }

    const model =
      cleanLabel(labels[0]);

    let version =
      cleanLabel(
        labels
          .slice(1, 3)
          .join(" ")
      );

    if (isInvalidLabel(model)) {
      continue;
    }

    if (
      version &&
      !looksLikeRealVersion(version)
    ) {
      version = "Standart";
    }

    output.push({
      brand: brand.brand,
      model,
      version: version || "Standart",
      listPrice: prices[0],
      campaignPrice:
        prices.length > 1 &&
        prices[1] <= prices[0]
          ? prices[1]
          : null,
      sourceUrl
    });
  }

  return output;
}

async function scrapeUrl(page, brand, url) {
  console.log(`[${brand.brand}] deneniyor: ${url}`);

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 45000
  });

  await page.waitForTimeout(3500);

  await page.evaluate(async () => {
    await new Promise(resolve => {
      let total = 0;

      const timer =
        setInterval(() => {
          window.scrollBy(0, 800);
          total += 800;

          if (
            total > document.body.scrollHeight ||
            total > 12000
          ) {
            clearInterval(timer);
            resolve();
          }
        }, 120);
    });
  });

  await page.waitForTimeout(1000);

  const tableRecords =
    await extractTables(
      page,
      brand,
      url
    );

  const cardRecords =
    await extractCards(
      page,
      brand,
      url
    );

  return dedupe([
    ...tableRecords,
    ...cardRecords
  ]);
}

function mergeWithPrevious(fresh, previous) {
  const now =
    new Date().toISOString();

  const previousMap =
    new Map();

  for (const item of previous.prices || []) {
    previousMap.set(
      makeKey(item),
      item
    );
  }

  return fresh.map(item => {
    const old =
      previousMap.get(
        makeKey(item)
      );

    if (!old) {
      return {
        ...item,
        previousListPrice: null,
        previousCampaignPrice: null,
        firstSeenAt: now,
        lastSeenAt: now,
        lastChangedAt: now
      };
    }

    const changed =
      old.listPrice !== item.listPrice ||
      old.campaignPrice !== item.campaignPrice;

    return {
      ...item,

      previousListPrice:
        changed
          ? old.listPrice
          : old.previousListPrice ??
            old.listPrice,

      previousCampaignPrice:
        changed
          ? old.campaignPrice
          : old.previousCampaignPrice ??
            old.campaignPrice,

      firstSeenAt:
        old.firstSeenAt || now,

      lastSeenAt:
        now,

      lastChangedAt:
        changed
          ? now
          : old.lastChangedAt || now
    };
  });
}

async function main() {
  const previous =
    await readPrevious();

  const browser =
    await chromium.launch({
      headless: true
    });

  const context =
    await browser.newContext({
      locale: "tr-TR",

      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/138.0 Safari/537.36"
    });

  const allFresh = [];
  const sourceStatus = {};

  try {
    for (const brand of BRANDS) {
      const page =
        await context.newPage();

      await configurePage(page);

      try {
        const urls =
          await discoverPriceUrls(
            page,
            brand
          );

        let brandRecords = [];
        let successfulUrl = null;

        for (const url of urls.slice(0, 6)) {
          try {
            const records =
              await scrapeUrl(
                page,
                brand,
                url
              );

            if (
              records.length >
              brandRecords.length
            ) {
              brandRecords =
                records;

              successfulUrl =
                url;
            }

            if (
              brandRecords.length >= 3
            ) {
              break;
            }
          } catch (error) {
            console.log(
              `[${brand.brand}] sayfa hatası:`,
              String(error)
            );
          }
        }

        brandRecords =
          dedupe(brandRecords);

        if (brandRecords.length) {
          allFresh.push(...brandRecords);

          sourceStatus[brand.brand] = {
            ok: true,
            count: brandRecords.length,
            sourceUrl: successfulUrl,
            checkedAt:
              new Date().toISOString()
          };

          console.log(
            `[${brand.brand}] ${brandRecords.length} temiz kayıt`
          );
        } else {
          throw new Error(
            "Geçerli fiyat kaydı çıkarılamadı."
          );
        }
      } catch (error) {
        console.log(
          `[${brand.brand}] başarısız:`,
          String(error)
        );

        const oldRecords =
          (previous.prices || [])
            .filter(
              item =>
                item.brand ===
                brand.brand
            )
            .filter(isValidRecord);

        allFresh.push(...oldRecords);

        sourceStatus[brand.brand] = {
          ok: false,
          count: oldRecords.length,
          error: String(error),
          checkedAt:
            new Date().toISOString(),
          preservedPrevious:
            oldRecords.length > 0
        };
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  const unique =
    dedupe(allFresh);

  const merged =
    mergeWithPrevious(
      unique,
      previous
    );

  const payload = {
    updatedAt:
      new Date().toISOString(),

    count:
      merged.length,

    brands:
      new Set(
        merged.map(
          item => item.brand
        )
      ).size,

    prices:
      merged,

    sources:
      sourceStatus
  };

  await fs.mkdir(
    path.dirname(
      OUTPUT_PATH
    ),
    {
      recursive: true
    }
  );

  await fs.writeFile(
    OUTPUT_PATH,
    JSON.stringify(
      payload,
      null,
      2
    ) + "\n",
    "utf8"
  );

  console.log(
    `Tamamlandı: ${payload.count} temiz fiyat / ${payload.brands} marka`
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
