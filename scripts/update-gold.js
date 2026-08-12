import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUTPUT =
  path.resolve("data/gold-latest.json");

const SOURCE_URL =
  "https://altin.doviz.com/gram-altin";

function cleanText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTRY(value) {
  const text = cleanText(value);

  if (!text) {
    return null;
  }

  const normalized = text
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const number =
    Number(normalized);

  return Number.isFinite(number)
    ? number
    : null;
}

function parsePercent(value) {
  const text = cleanText(value);

  if (!text) {
    return null;
  }

  const normalized = text
    .replace("%", "")
    .replace(",", ".")
    .trim();

  const number =
    Number(normalized);

  return Number.isFinite(number)
    ? number
    : null;
}

function uniqueByInstitution(items) {
  const map = new Map();

  for (const item of items) {
    const key =
      item.institution
        .toLocaleLowerCase("tr-TR")
        .trim();

    if (!key) {
      continue;
    }

    if (
      item.buy == null ||
      item.sell == null
    ) {
      continue;
    }

    map.set(key, item);
  }

  return [...map.values()];
}

async function readPrevious() {
  try {
    const raw =
      await fs.readFile(
        OUTPUT,
        "utf8"
      );

    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function main() {

  const previous =
    await readPrevious();

  const browser =
    await chromium.launch({
      headless: true
    });

  try {

    const context =
      await browser.newContext({

        locale:
          "tr-TR",

        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/138.0 Safari/537.36"

      });

    const page =
      await context.newPage();

    console.log(
      "Doviz.com gram altin sayfasi aciliyor..."
    );

    await page.goto(
      SOURCE_URL,
      {
        waitUntil:
          "domcontentloaded",

        timeout:
          60000
      }
    );

    await page.waitForTimeout(
      5000
    );

    /*
     * Sayfanın altındaki banka tablosunun
     * yüklenmesini kolaylaştırmak için aşağı kay.
     */
    await page.evaluate(
      async () => {

        await new Promise(
          resolve => {

            let total = 0;

            const timer =
              setInterval(
                () => {

                  window.scrollBy(
                    0,
                    700
                  );

                  total +=
                    700;

                  if (
                    total >
                      document.body.scrollHeight ||
                    total >
                      15000
                  ) {

                    clearInterval(
                      timer
                    );

                    resolve();

                  }

                },
                120
              );

          }
        );

      }
    );

    await page.waitForTimeout(
      2000
    );

    const rawRows =
      await page.evaluate(
        () => {

          const tables =
            Array.from(
              document.querySelectorAll(
                "table"
              )
            );

          const results = [];

          for (const table of tables) {

            const tableText =
              (
                table.innerText ||
                table.textContent ||
                ""
              )
              .toLocaleLowerCase(
                "tr-TR"
              );

            /*
             * Sadece banka kurları tablosu.
             */
            if (
              !tableText.includes(
                "alış"
              ) ||
              !tableText.includes(
                "satış"
              ) ||
              !tableText.includes(
                "makas"
              )
            ) {
              continue;
            }

            const rows =
              Array.from(
                table.querySelectorAll(
                  "tr"
                )
              );

            for (const row of rows) {

              const cells =
                Array.from(
                  row.querySelectorAll(
                    "th,td"
                  )
                )
                .map(
                  cell =>
                    (
                      cell.innerText ||
                      cell.textContent ||
                      ""
                    ).trim()
                );

              if (
                cells.length >= 3
              ) {

                results.push(
                  cells
                );

              }

            }

          }

          return results;

        }
      );

    console.log(
      `Ham satir sayisi: ${rawRows.length}`
    );

    const prices = [];

    for (const cells of rawRows) {

      const institution =
        cleanText(
          cells[0]
        );

      /*
       * Header satırlarını alma.
       */
      if (
        !institution ||
        /banka|kurum/i
          .test(
            institution
          )
      ) {
        continue;
      }

      const buy =
        parseTRY(
          cells[1]
        );

      const sell =
        parseTRY(
          cells[2]
        );

      if (
        buy == null ||
        sell == null ||
        buy <= 0 ||
        sell <= 0
      ) {
        continue;
      }

      const spread =
        cells[3]
          ? parseTRY(
              cells[3]
            )
          : sell - buy;

      const spreadPercent =
        cells[4]
          ? parsePercent(
              cells[4]
            )
          : (
              buy > 0
                ? (
                    (
                      sell -
                      buy
                    ) /
                    buy *
                    100
                  )
                : null
            );

      prices.push({

        institution,

        buy,

        sell,

        spread:
          spread ??
          (
            sell -
            buy
          ),

        spreadPercent

      });

    }

    const cleanPrices =
      uniqueByInstitution(
        prices
      );

    /*
     * Çok az veri geldiyse
     * eski dosyayı bozma.
     */
    if (
      cleanPrices.length <
      5
    ) {

      throw new Error(
        `Yalnizca ${cleanPrices.length} kurum okunabildi. ` +
        "Mevcut veri korunacak."
      );

    }

    /*
     * Alışta yüksek fiyat =
     * kullanıcı altın satarken daha avantajlı.
     */
    const bestBuy =
      [...cleanPrices]
        .sort(
          (a,b) =>
            b.buy -
            a.buy
        )[0] ||
        null;

    /*
     * Satışta düşük fiyat =
     * kullanıcı altın alırken daha avantajlı.
     */
    const bestSell =
      [...cleanPrices]
        .sort(
          (a,b) =>
            a.sell -
            b.sell
        )[0] ||
        null;

    const bestSpread =
      [...cleanPrices]
        .sort(
          (a,b) =>
            a.spread -
            b.spread
        )[0] ||
        null;

    const payload = {

      updatedAt:
        new Date()
          .toISOString(),

      source:
        "Döviz.com",

      sourceUrl:
        SOURCE_URL,

      count:
        cleanPrices.length,

      bestBuy,

      bestSell,

      bestSpread,

      prices:
        cleanPrices
          .sort(
            (a,b) =>
              a.sell -
              b.sell
          )

    };

    await fs.mkdir(
      path.dirname(
        OUTPUT
      ),
      {
        recursive: true
      }
    );

    await fs.writeFile(
      OUTPUT,
      JSON.stringify(
        payload,
        null,
        2
      ) +
      "\n",
      "utf8"
    );

    console.log(
      `Tamamlandi: ${cleanPrices.length} kurum kaydedildi.`
    );

  } catch (error) {

    console.error(
      "Altin fiyatlari okunamadi:",
      error
    );

    if (previous) {

      console.log(
        "Eski gold-latest.json korunuyor."
      );

      process.exit(0);

    }

    throw error;

  } finally {

    await browser.close();

  }

}

main()
  .catch(
    error => {

      console.error(
        error
      );

      process.exit(1);

    }
  );
