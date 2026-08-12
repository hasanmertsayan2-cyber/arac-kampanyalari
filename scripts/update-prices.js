<!DOCTYPE html>
<html lang="tr">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>Sıfır Araç Fiyatları</title>

<link
  href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600;700&display=swap"
  rel="stylesheet"
>

<style>

:root{
  --bg:#12151a;
  --surface:#1b1f26;
  --surface2:#232833;
  --border:#2a303c;

  --text:#edeff2;
  --muted:#8b93a1;

  --teal:#00d4b8;
  --amber:#ffb020;
  --red:#ff5c5c;
}

*{
  box-sizing:border-box;
}

body{
  margin:0;

  background:
    radial-gradient(
      ellipse at 20% -10%,
      rgba(0,212,184,.08),
      transparent 45%
    ),
    var(--bg);

  color:var(--text);

  font-family:
    'IBM Plex Sans',
    sans-serif;
}

.wrap{
  max-width:1150px;
  margin:auto;
  padding:
    30px 20px 80px;
}

.topnav{
  display:flex;
  gap:8px;
  margin-bottom:22px;
}

.nav{
  padding:
    10px 16px;

  border-radius:8px;

  border:
    1px solid var(--border);

  text-decoration:none;

  color:
    var(--muted);

  background:
    var(--surface);

  font-family:
    'IBM Plex Mono',
    monospace;

  font-size:12px;
}

.nav.active{
  background:
    var(--teal);

  color:#091511;

  border-color:
    var(--teal);

  font-weight:700;
}

.hero{
  padding:
    25px;

  border:
    1px solid var(--border);

  border-radius:14px;

  background:
    linear-gradient(
      180deg,
      var(--surface),
      var(--surface2)
    );

  margin-bottom:22px;
}

h1{
  margin:0 0 8px;

  font-family:
    'Oswald',
    sans-serif;

  font-size:
    clamp(28px,5vw,42px);

  text-transform:uppercase;
}

.sub{
  color:
    var(--muted);

  font-size:13px;

  margin:0;
}

.controls{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  margin-bottom:14px;
}

input{
  flex:1;
  min-width:220px;

  padding:
    12px 14px;

  border-radius:8px;

  border:
    1px solid var(--border);

  background:
    var(--surface);

  color:
    var(--text);

  font-size:14px;
}

input:focus{
  outline:none;
  border-color:
    var(--teal);
}

.brands{
  display:flex;
  flex-wrap:wrap;
  gap:7px;
  margin-bottom:20px;
}

.brand-btn{
  border:
    1px solid var(--border);

  background:
    var(--surface);

  color:
    var(--muted);

  border-radius:999px;

  padding:
    7px 12px;

  cursor:pointer;

  font-family:
    'IBM Plex Mono',
    monospace;

  font-size:11px;
}

.brand-btn.active{
  background:
    var(--teal);

  color:#071410;

  border-color:
    var(--teal);
}

.summary{
  color:
    var(--muted);

  font-family:
    'IBM Plex Mono',
    monospace;

  font-size:12px;

  margin-bottom:15px;
}

.grid{
  display:grid;

  grid-template-columns:
    repeat(
      auto-fill,
      minmax(310px,1fr)
    );

  gap:14px;
}

.card{
  background:
    linear-gradient(
      145deg,
      var(--surface),
      #181c22
    );

  border:
    1px solid var(--border);

  border-radius:12px;

  padding:18px;

  transition:
    transform .15s,
    border-color .15s;
}

.card:hover{
  transform:
    translateY(-2px);

  border-color:
    var(--teal);
}

.brand{
  color:
    var(--muted);

  font-family:
    'IBM Plex Mono',
    monospace;

  font-size:10px;

  letter-spacing:.12em;

  text-transform:uppercase;
}

.model{
  font-family:
    'Oswald',
    sans-serif;

  font-size:22px;

  margin:
    3px 0 4px;
}

.version{
  color:
    var(--muted);

  font-size:12.5px;

  line-height:1.45;

  min-height:36px;

  margin-bottom:16px;
}

.price-label{
  color:
    var(--muted);

  font-family:
    'IBM Plex Mono',
    monospace;

  font-size:10px;

  margin-top:8px;
}

.price{
  font-family:
    'Oswald',
    sans-serif;

  font-size:25px;

  font-weight:600;
}

.campaign-price{
  color:
    var(--teal);
}

.old-price{
  color:
    var(--muted);

  text-decoration:
    line-through;

  font-size:14px;
}

.change{
  display:inline-block;

  margin-top:6px;

  padding:
    4px 7px;

  border-radius:6px;

  font-family:
    'IBM Plex Mono',
    monospace;

  font-size:10px;
}

.up{
  color:
    var(--red);

  background:
    rgba(255,92,92,.1);
}

.down{
  color:
    var(--teal);

  background:
    rgba(0,212,184,.1);
}

.source{
  display:block;

  text-align:center;

  margin-top:16px;

  padding:
    9px 10px;

  border:
    1px solid var(--teal);

  border-radius:8px;

  text-decoration:none;

  color:
    var(--text);

  font-family:
    'IBM Plex Mono',
    monospace;

  font-size:11px;
}

.source:hover{
  background:
    var(--teal);

  color:#081411;
}

.empty,
.loading,
.error{
  padding:60px 20px;

  text-align:center;

  color:
    var(--muted);

  font-family:
    'IBM Plex Mono',
    monospace;
}

.error{
  color:
    var(--red);
}

@media(max-width:700px){

  .wrap{
    padding:
      18px 14px 50px;
  }

  .brands{
    flex-wrap:nowrap;

    overflow-x:auto;

    scrollbar-width:none;
  }

  .brands::-webkit-scrollbar{
    display:none;
  }

  .brand-btn{
    flex:0 0 auto;
  }

  .grid{
    grid-template-columns:
      1fr;
  }

}

</style>

</head>


<body>

<div class="wrap">

  <div class="topnav">

    <a
      href="/"
      class="nav"
    >
      Kampanyalar
    </a>

    <a
      href="/prices.html"
      class="nav active"
    >
      Sıfır Araç Fiyatları
    </a>

  </div>


  <div class="hero">

    <h1>
      SIFIR ARAÇ FİYATLARI
    </h1>

    <p
      id="updated"
      class="sub"
    >
      Fiyatlar yükleniyor...
    </p>

  </div>


  <div class="controls">

    <input
      id="search"
      placeholder="Marka, model veya versiyon ara..."
    >

  </div>


  <div
    id="brands"
    class="brands"
  ></div>


  <div
    id="summary"
    class="summary"
  ></div>


  <div id="content">

    <div class="loading">
      Fiyatlar yükleniyor...
    </div>

  </div>

</div>


<script>

let ALL = [];

let activeBrand =
  "Tümü";

let query =
  "";


function money(value){

  if(
    value === null ||
    value === undefined
  ){
    return "—";
  }

  return new Intl
    .NumberFormat(
      "tr-TR"
    )
    .format(value) +
    " TL";

}


function changeHtml(item){

  const previous =
    item.previousListPrice;

  const current =
    item.listPrice;


  if(
    !previous ||
    !current ||
    previous === current
  ){
    return "";
  }


  const difference =
    current -
    previous;


  if(
    difference > 0
  ){

    return `
      <div class="change up">
        ↑ ${money(difference)}
      </div>
    `;

  }


  return `
    <div class="change down">
      ↓ ${money(
        Math.abs(
          difference
        )
      )}
    </div>
  `;

}


function brands(){

  return [
    "Tümü",

    ...Array
      .from(
        new Set(
          ALL.map(
            x => x.brand
          )
        )
      )
      .sort(
        (a,b)=>
          a.localeCompare(
            b,
            "tr"
          )
      )
  ];

}


function filtered(){

  return ALL.filter(item => {

    if(
      activeBrand !==
      "Tümü" &&
      item.brand !==
      activeBrand
    ){
      return false;
    }


    if(query){

      const hay =
        [
          item.brand,
          item.model,
          item.version
        ]
          .join(" ")
          .toLocaleLowerCase(
            "tr-TR"
          );


      if(
        !hay.includes(
          query
            .toLocaleLowerCase(
              "tr-TR"
            )
        )
      ){
        return false;
      }

    }


    return true;

  });

}


function renderBrands(){

  const el =
    document.getElementById(
      "brands"
    );

  el.innerHTML =
    "";


  brands().forEach(
    brand => {

      const button =
        document.createElement(
          "button"
        );


      button.className =
        "brand-btn" +
        (
          brand ===
          activeBrand
            ? " active"
            : ""
        );


      button.textContent =
        brand;


      button.onclick =
        () => {

          activeBrand =
            brand;

          render();

        };


      el.appendChild(
        button
      );

    }
  );

}


function render(){

  renderBrands();


  const items =
    filtered();


  document
    .getElementById(
      "summary"
    )
    .textContent =
      `${items.length} fiyat kaydı listeleniyor`;


  const content =
    document.getElementById(
      "content"
    );


  if(
    !items.length
  ){

    content.innerHTML =
      `
        <div class="empty">
          Eşleşen fiyat bulunamadı.
        </div>
      `;

    return;

  }


  const grid =
    document.createElement(
      "div"
    );


  grid.className =
    "grid";


  for(
    const item of items
  ){

    const card =
      document.createElement(
        "div"
      );


    card.className =
      "card";


    const campaign =
      item.campaignPrice &&
      item.campaignPrice !==
        item.listPrice;


    card.innerHTML =
      `

        <div class="brand">
          ${item.brand}
        </div>

        <div class="model">
          ${item.model}
        </div>

        <div class="version">
          ${item.version || ""}
        </div>


        <div class="price-label">
          Liste Fiyatı
        </div>

        <div class="price">
          ${money(
            item.listPrice
          )}
        </div>


        ${
          campaign
            ? `

              <div class="price-label">
                Kampanyalı Fiyat
              </div>

              <div class="price campaign-price">
                ${money(
                  item.campaignPrice
                )}
              </div>

            `
            : ""
        }


        ${changeHtml(item)}


        ${
          item.sourceUrl
            ? `

              <a
                class="source"
                href="${item.sourceUrl}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Resmi Fiyat Sayfası →
              </a>

            `
            : ""
        }

      `;


    grid.appendChild(
      card
    );

  }


  content.innerHTML =
    "";


  content.appendChild(
    grid
  );

}


async function load(){

  try{

    const response =
      await fetch(
        "/data/prices-latest.json",
        {
          cache:
            "no-store"
        }
      );


    if(
      !response.ok
    ){
      throw new Error(
        "Fiyat dosyası okunamadı."
      );
    }


    const data =
      await response.json();


    ALL =
      data.prices || [];


    const updated =
      document.getElementById(
        "updated"
      );


    if(
      data.updatedAt
    ){

      const date =
        new Date(
          data.updatedAt
        );


      updated.textContent =
        `${data.brands || 0} marka · ${data.count || 0} fiyat · Son güncelleme: ` +
        date.toLocaleString(
          "tr-TR",
          {
            timeZone:
              "Europe/Istanbul"
          }
        );

    }else{

      updated.textContent =
        "Henüz fiyat güncellemesi yapılmadı.";

    }


    render();

  }catch(error){

    document
      .getElementById(
        "content"
      )
      .innerHTML =
        `
          <div class="error">
            ${error.message}
          </div>
        `;

  }

}


document
  .getElementById(
    "search"
  )
  .addEventListener(
    "input",
    event => {

      query =
        event.target.value;

      render();

    }
  );


load();

</script>

</body>

</html>
