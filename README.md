# Araç Kampanyaları — Canlı Site

Bu proje iki dosyadan oluşur:

- `index.html` — Tarayıcıda gösterilen arayüz. Sayfa açıldığında `/api/campaigns` adresinden **önbellekteki** veriyi okur; bu okuma hiçbir zaman yeni bir ücretli aramayı tetiklemez.
- `api/campaigns.js` — Vercel üzerinde çalışan bir sunucu fonksiyonu. Bu fonksiyon Anthropic API'sini web arama aracıyla çağırır, Claude'un bulduğu güncel kampanyaları JSON formatında döner. Sonuç 24 saat boyunca önbelleğe alınır. Yeni bir arama sadece **gizli anahtarını bilen** bir istekle (aşağıya bak) tetiklenebilir - rastgele bir ziyaretçi bunu tetikleyemez.

## Her sabah veriyi kendin güncellemek

Deploy ettikten ve `REFRESH_SECRET` değişkenini tanımladıktan sonra, şu adresi tarayıcında açman yeterli:

```
https://senin-domainin.com/api/campaigns?refresh=1&key=SENIN_REFRESH_SECRET_DEGERIN
```

Bunu tarayıcında yer imi (bookmark) olarak kaydedip her sabah tek tıkla açabilirsin. Sayfa sana ham JSON gösterecek - "başarılı" anlamına gelir, siteye geri dönüp yenilenmiş listeyi görebilirsin.

**Önemli:** Bu bağlantıyı kimseyle paylaşma - anahtarı bilen herkes senin adına ücretli istek tetikleyebilir.

## Yayına alma adımları

1. **API anahtarı al:** [console.anthropic.com](https://console.anthropic.com) üzerinden hesap aç, bir API anahtarı oluştur, hesaba kullanım bakiyesi yükle.

2. **GitHub'a yükle:** Bu klasördeki tüm dosyaları yeni bir GitHub reposuna yükle (`.env.example` hariç `.env` dosyası ASLA yüklenmemeli).

3. **Vercel'e bağla:**
   - [vercel.com](https://vercel.com) adresine GitHub hesabınla giriş yap.
   - "Add New… → Project" de, reponu seç.
   - Framework olarak "Other" seçili kalabilir, ek bir ayar gerekmez.
   - "Deploy" butonuna bas.

4. **Ortam değişkenlerini tanımla:**
   - Proje sayfasında **Settings → Environment Variables**'a git.
   - `ANTHROPIC_API_KEY` → 1. adımda aldığın anahtar.
   - `REFRESH_SECRET` → kendi uydurduğun, uzun ve tahmin edilemez bir metin (şifre gibi düşün, örn. bir şifre yöneticisiyle üretebilirsin).
   - Kaydettikten sonra projeyi yeniden deploy et (Deployments sekmesinden "Redeploy").

5. **Test et:** Vercel'in verdiği geçici adrese girip (`xxx.vercel.app`) sitenin kampanyaları getirdiğini doğrula.

6. **Domain bağla (opsiyonel):**
   - Bir alan adı satın al (Natro, Turhost, GoDaddy vb.).
   - Vercel projesinde **Settings → Domains**'e alan adını gir.
   - Vercel'in verdiği DNS kayıtlarını (A / CNAME) domain sağlayıcının panelinden ekle.
   - DNS yayılması birkaç saat sürebilir.

## Maliyet notu

Her yetkili yenileme isteği (yukarıdaki gizli bağlantı) Anthropic API'sine birkaç web araması + birkaç bin token'lık bir istek gönderir. Ağustos 2026 itibarıyla kabaca **istek başına $0.10-0.15** arası bir maliyet çıkar. Günde bir kez sen tetiklersen ayda yaklaşık **$3-5** eder. Güncel fiyatlandırmayı [console.anthropic.com](https://console.anthropic.com) üzerinden takip edebilirsin.

Önbellek süresini `api/campaigns.js` içindeki `CACHE_TTL_MS` değerini değiştirerek ayarlayabilirsin (şu an 24 saat - günde bir kez elle tetiklediğin senaryoya uygun).

## Veri formatını değiştirmek

`api/campaigns.js` içindeki `prompt` metnini düzenleyerek Claude'dan istenen kampanya sayısını, formatı veya odaklanılacak marka/segmentleri değiştirebilirsin.
