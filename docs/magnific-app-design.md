# Magnific App — Design Reference (design.md)

> **Kaynak:** `https://www.magnific.com/app`, 25 Eylül 2026. Oturum açık bir hesapla, tarayıcıda gezilerek çıkarıldı.
> **Yöntem:** Değerler `getComputedStyle` ile doğrudan ölçüldü. Tabloda **ölçüldü** yazanlar sayfadan birebir alındı, **gözlem** yazanlar ekran görüntüsünden okundu.
> **İncelenen sayfalar:**
> - Home (`/app`) ve Explore (`/app/explore`)
> - Projects (`/app/projects/work`) ve Library → Characters (`/app/library/characters`)
> - Image Tools (`/app/tools/image`) ve Image Generator (`/app/ai-image-generator`)
> - Video Generator (`/app/ai-video-generator`) ve Voice Generator (`/app/voiceover-generator`)
> - Oluştur (+) menüsü
>
> **Kapsam dışı:** Spaces sonsuz canvas'ı ve Stock tarandı ama ölçülmedi. Dark tema hesap ayarı değiştirilmeden, yalnızca sitenin tanımladığı CSS değişkenlerinden aktarıldı.
> Bu doküman Magnific'in resmi tasarım sistemi değildir. Canlı arayüzden yapılmış bir tersine mühendislik referansıdır.

---

## 1. Karakter

- **Nötr, sakin ve içerik öncelikli.** Arayüz neredeyse tamamen gri tonlarından oluşur. Renk yalnızca üç yerde kullanılır: marka pembesi (oluştur ve yükselt aksiyonları), odak ve etkin durumlar için mavi, araç kategorilerini ayırt eden pastel tonlar.
- **Yüzen yüzeyler.** Sol rail ve ana çalışma alanı, `#F5F5F5` zemin üzerinde 8 px boşlukla duran, 16 px köşeli ayrı kartlardır. Arada kenarlık yoktur; ayrımı zemin farkı yapar.
- **Küçük ve yoğun tipografi.** Arayüz metninin çoğu 12 px / 500 ağırlıktadır. Başlıklarda ayrı bir display fontu (Klarheit) kullanılır.
- **Kenarlık yerine ton.** Input, select ve chip'ler kenarlıksız, `rgba(115,115,115,.05)` gibi çok hafif gri dolgulu yüzeylerdir. Kenarlık yalnızca odak, kesikli yükleme alanları ve küçük meta chip'lerinde görünür.
- **Birincil aksiyon siyahtır.** "Create" ve "Add" gibi sayfa aksiyonları `#1A1A1A` dolgulu butonlardır. Pembe, ürün ve para kazandırma aksiyonlarına ayrılmıştır ("+" oluştur, "Upgrade").

---

## 2. Renk

### 2.1 Sitenin tanımladığı CSS değişkenleri (ölçüldü)

HSL bileşenleri Tailwind tarzıdır; kullanımı `hsl(var(--x))` şeklindedir.

| Değişken | Light | Dark |
|---|---|---|
| `--surface-0` | `0 0% 100%` → `#FFFFFF` | `0 0% 6%` → `#0F0F0F` |
| `--surface-1` | `0 0% 97%` → `#F7F7F7` | `0 0% 11%` → `#1C1C1C` |
| `--surface-border-1` | `hsla(0,0%,5%,.1)` | `hsla(0,0%,100%,.1)` |
| `--surface-foreground-0` | `0 0% 5%` → `#0D0D0D` | `0 0% 97%` → `#F7F7F7` |
| `--surface-foreground-1` | `0 0% 19%` → `#303030` | `0 0% 90%` → `#E6E6E6` |
| `--primary-0` | `222 81% 56%` → `#3B6FE8` | aynı |

### 2.2 Nötr palet (ölçüldü, kullanım sıklığına göre)

| Token (öneri) | Değer | Kullanım |
|---|---|---|
| `neutral-0` | `#FFFFFF` | Rail kartı, içerik kartları, menü |
| `neutral-25` | `#FAFAFA` | Ana çalışma alanı yüzeyi |
| `neutral-50` | `#F5F5F5` | Uygulama zemini (kartların arkası), tab rayı, araç başlık kartı |
| `neutral-75` | `#EDEDED` / `#ECECEC` | Segmented control rayı |
| `neutral-100` | `#E3E3E3` | Pasif birincil buton ("Generate" boşken) |
| `neutral-800` | `#2B2B2B` | Koyu küçük yüzeyler |
| `ink-900` | `#1A1A1A` | Birincil metin, siyah birincil buton |
| `ink-950` | `#0D0D0D` / `#0F0F0F` | En koyu metin |
| `text-700` | `#363636` | Güçlü ikincil metin |
| `text-600` | `#424242` | İkon ve etiket metni |
| `text-500` | `#616161` | İkincil metin, pasif sekme, bölüm etiketi |
| `text-400` | `#737373` | Üçüncül metin |

**Alfa tonları (ölçüldü):**

| Değer | Kullanım |
|---|---|
| `rgba(115,115,115,.05)` | Kontrol dolgusu: select, referans kutusu, meta chip |
| `rgba(115,115,115,.15)` | Rail'de etkin öğe arka planı |
| `rgba(16,16,16,.10)` | Kenarlık (menü, kesikli kutu, chip), nötr ikon kutusu |
| `rgba(16,16,16,.05)` / `.20` | Daha zayıf ve daha güçlü kenarlık |
| `rgba(66,66,66,.25)` | Medya üstü koyu overlay |

### 2.3 Marka ve durum renkleri (ölçüldü)

| Token (öneri) | Değer | Kullanım |
|---|---|---|
| `brand-pink` | `#FF57AE` (`rgb(255,87,174)`) | Rail'deki "+" oluştur butonu, "Upgrade" metni, bildirim rozeti, "New" ve "Flow" etiketleri |
| `brand-pink-soft` | `rgba(255,88,174,.15)` | Pembe etiket zemini |
| `primary` | `#3B6FE8` (`--primary-0`) | Odak kenarı, switch açık durumu |
| `accent-blue` | `#506BF2` (`rgb(80,107,242)`) | Bilgi CTA'sı ("Guided tour" pill) |

Pembe butonun üzerindeki ikon koyu (`#0F0F0F`), beyaz değil.

### 2.4 Araç kategorisi renkleri (ölçüldü)

Her ürün kategorisinin bir tonu vardır. İkon bu tonun tam rengindedir, 48×48 kutu zemini aynı rengin %10 alfasıdır. Aynı pastel ton araç panelinin başlık kartında da kullanılır.

| Kategori | İkon | Kutu zemini |
|---|---|---|
| Spaces | `#8566DC` | `rgba(133,102,220,.1)` |
| Image | `#4F69F2` | `rgba(79,105,242,.1)` |
| Video | `#3CD39F` (zemin tonu `#17CB8D`) | `rgba(23,203,141,.1)` |
| Audio | `#00CDC6` | `rgba(0,205,198,.1)` |
| Design | `#CC7E80` | `rgba(204,126,128,.1)` |
| 3D | `#B39581` | `rgba(179,149,129,.1)` |
| Stock / Connections | `#101010` | `rgba(16,16,16,.1)` |

---

## 3. Tipografi

### 3.1 Aileler (ölçüldü)

| Rol | Aile | Yüklenen ağırlıklar |
|---|---|---|
| Arayüz (UI) | **Geist**, ui-sans-serif, system-ui… | 400, 500, 600, 700 |
| Yedek UI | Inter | 500 |
| Display / başlık | **Klarheit** → Degular → Geist → Inter | 800 (sayfada 500 olarak da çizilir) |

Klarheit ticari bir fonttur ve lisans gerektirir. Açık kaynak alternatifi olarak Geist 600–700 kullanılabilir.

### 3.2 Ölçek (ölçüldü)

| Rol | Boyut / satır | Ağırlık | Harf aralığı | Örnek |
|---|---|---|---|---|
| Display H1 | 28 / 42 | 500 (Klarheit) | normal | "Good afternoon, start creating!" |
| Sayfa sekmesi (büyük) | ~24 | 600 | — | Explore: "Discover / Use Cases…" (gözlem) |
| Başlık | 20 / 30 | 500 | −0.2px | Bölüm başlıkları |
| Gövde büyük | 15 / 24 | 500 | normal | Kart başlıkları |
| Gövde | 14 / 22.75 | 400–600 | normal | Prompt metni, buton metni |
| **UI varsayılan** | **12 / 18** | **500** | normal | Menü, sekme, buton, liste (en sık kullanılan) |
| Bölüm etiketi | 9.92 / 14.88 | 600, BÜYÜK HARF | normal | MODEL, REFERENCES, PROMPT |
| Mikro etiket | 10 / 10 | 500 | 0.2px | Rozet, durum |
| Rozet sayı | 8 / 8 | 700 | — | Bildirim sayacı |

**Metin renkleri:** Birincil `#1A1A1A`, ikincil `#616161`, üçüncül `#737373`. Pasif öğeler rengini değiştirir; opaklık kullanılmaz.

---

## 4. Boşluk, boyut ve köşe

### 4.1 Boşluk (ölçüldü)

- **Temel adım 4 px.** Sık görülen değerler 4, 6, 8, 12, 16, 20 ve 28.
- **Kontrol padding'i:** Buton, select ve sekme `0 16px` veya `6px 16px`. Menü öğesi `6px 8px 6px 4px`. Meta chip `0 8px`.
- **Kartlar:** Proje kartı `16px 28px`, banner `12px 18px`, araç başlık kartı `8px 8px 8px 12px`.
- **Kabuk:** Rail ve ana yüzey pencere kenarından ve birbirinden 8 px uzakta. Rail içi padding `16px 20px`.

### 4.2 Kontrol yükseklikleri (ölçüldü)

| Boyut | Yükseklik | Kullanım |
|---|---|---|
| xs | 24 | Segmented öğesi, meta chip |
| sm | 30 | Pill sekme |
| **md** | **32** | **Buton, select, aspect chip, menü öğesi, rail ikonu (varsayılan)** |
| lg | 40 | Tam genişlik "Generate" |
| Kutu | 48 | Kategori ikon kutusu |
| Referans kutusu | 65 × 65 | Style / Character / Add |

### 4.3 Köşe yarıçapı (ölçüldü, sıklığa göre)

| Değer | Kullanım |
|---|---|
| **8 px** | Buton, select, input, rail ikonu, menü öğesi, ikon kutusu, segmented (en yaygın) |
| **9999 px** | Pill sekmeler (Image / Video / Audio), "Guided tour", avatar |
| **16 px** | Rail kartı, ana yüzey, içerik kartı, banner, menü |
| 12 px | Araç başlık kartı |
| 6 px | Küçük öğeler |
| 4 px | Meta chip ("wan 3.0", "12 sec", "16:9") |

---

## 5. Yükseklik (elevation)

Kartlarda gölge kullanılmaz; ayrımı zemin farkı sağlar (beyaz kart, `#F5F5F5` veya `#FAFAFA` zemin).

Gölge yalnızca **overlay**'lerde görülür. Menüde ölçülen çok katmanlı gölge:

```css
box-shadow:
  0 0 2px rgba(18,18,18,.08),
  0 25px 10px rgba(18,18,18,.02),
  0 14px 9px rgba(18,18,18,.02),
  0 6px 6px rgba(18,18,18,.04),
  0 2px 4px rgba(18,18,18,.08);
border: 1px solid rgba(16,16,16,.1);
border-radius: 16px;
```

---

## 6. Düzen (layout)

```
┌─ zemin #F5F5F5 ─────────────────────────────────────────────────────────────┐
│ ┌rail 72┐ ┌─ ana yüzey #FAFAFA, r16 ───────────────────────────────────────┐ │
│ │ logo  │ │ top bar: [proje ▾ / breadcrumb]         Upgrade [Share] [·] (◯)│ │
│ │ [+]   │ │ ┌ araç paneli ~300 ┐ ┌ içerik alanı ───────────────────────────┐│ │
│ │ ⌂ ⌕ ▦ │ │ │ pill sekmeler    │ │ [Creations][Templates][Academy]  ♡ ⊞ ⚲ ││ │
│ │ ◎ ▢ ▥ │ │ │ araç başlık kartı│ │ zamana göre gruplu sonuç kartları       ││ │
│ │ ───── │ │ │ BÖLÜM ETİKETİ    │ │                                         ││ │
│ │ ⋮ ⚙ … │ │ │ kontroller       │ │                                         ││ │
│ │ 🔔 ⋯  │ │ │ [Generate]       │ │                                         ││ │
│ └───────┘ │ └──────────────────┘ └─────────────────────────────────────────┘│ │
│           └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Rail** (ölçüldü: 72 px, beyaz, r16, padding `16px 20px`). Yalnızca 32 × 32 ikonlardan oluşur; etiket yoktur, adı tooltip gösterir. Sırası:

1. Logo ve pembe "+" oluştur butonu.
2. Birincil hedefler: Home, Search, Explore, Stock, Projects, Library.
3. Ayırıcı.
4. Araç kısayolları: All tools, Spaces, Image, Video, Audio, Design, 3D.
5. Alta sabitlenmiş: Connections (nokta rozetli), Academy, Notifications (sayaçlı), More.

Etkin öğe `rgba(115,115,115,.15)` zeminli 8 px karedir.

**Top bar:** Solda proje seçici (renkli kare + ad + ⇅) veya breadcrumb (`Library › Characters`). Sağda sırasıyla pembe metin "Upgrade", kenarlıklı "Share" veya "Invite", ikon buton ve avatar. Top bar ayrı bir şerit değildir; ana yüzeyin içinde yer alır.

**Sayfa kalıpları:**
- **Home:** Ortalanmış display başlık, geniş arama kutusu (`⌘K` ipucu), kategori ızgarası (48 px renkli kutu + 15 px etiket), kapatılabilir beyaz banner ("Use Magnific everywhere…"), ardından iki kolon: proje listesi kartı ve empty state kartı.
- **Araç sayfası:** Sol panel, genişliği yaklaşık 300 px (kontroller 288 px). Sağda sonuç akışı. Sonuçlar tarih ve prompt başlığıyla gruplanır; gruplar başlık satırı + meta chip'ler + checkbox içeren `#F5F5F5` bloklardır.
- **Liste sayfası (Projects, Library):** İkinci seviye sidebar (~236 px öğe genişliği, gruplu, BÜYÜK HARF grup etiketleri) + içerik. Başlık satırında solda sayfa adı, sağda siyah "Create/Add", segmented filtre, filtre butonu ve arama.
- **Explore:** Büyük metin sekmeleri (etkinde koyu metin ve pembe alt çizgi; diğerleri açık gri). Altında yatay bölümler ("See all ›"), 4 kolon kart ızgarası ve medya kartları.

---

## 7. Bileşenler

### 7.1 Butonlar

| Varyant | Görünüm (ölçüldü) | Kullanım |
|---|---|---|
| **Primary (siyah)** | bg `#1A1A1A`, metin `#FFF`, 12/500, h32, r8, pad `0 16px`, ikon + metin | Sayfa aksiyonu: "+ Create", "+ Add" |
| **Brand (pembe)** | bg `#FF57AE`, ikon `#0F0F0F`, 32×32, r8 | Global "+" oluştur (rail) |
| **Generate (tam genişlik)** | h40, r8, pad `0 16px`, 14/400; pasifken bg `#E3E3E3` metin `#616161`; sağda ✦ ikonu | Araç panelinin altındaki birincil aksiyon |
| **Secondary (kenarlıklı)** | beyaz, 1px `rgba(16,16,16,.1)`, h32, r8, kilit veya kişi ikonu (gözlem) | "Share", "Invite" |
| **Ghost** | şeffaf, 12/500, h32, r8, pad `0 16px`, sağda "›" | "See all ›", "All projects ›" |
| **Info pill** | bg `#506BF2`, metin `#FAFAFA`, h32, r9999, pad `0 16px` | "Guided tour" |
| **Text link (pembe)** | metin `#FF57AE`, 12–14/500 | "Upgrade" |
| **Icon button** | 32×32, r8, şeffaf veya `rgba(115,115,115,.05)` | Top bar, ♡, arama |

### 7.2 Sekmeler

- **Pill tabs (araç kategorisi):** Ray `#F5F5F5` üzerinde pill öğeler. Etkin öğe beyaz pill ve `#1A1A1A` metin, pasif öğe `#616161`. Ölçüler 12/500, h30, pad `6px 16px`, r9999. Taşma olursa sağda yuvarlak "›" butonu çıkar.
- **İçerik sekmeleri:** "Creations / My templates / Academy". Aynı pill yapısında, her birinin başında ikon var; etkin öğe hafif gri zeminli.
- **Büyük sayfa sekmeleri (Explore):** Yaklaşık 24 px metin. Etkin sekme koyu metin ve pembe alt çizgi, pasifler açık gri (`#C7C7C7` civarı, gözlem).
- **Segmented filtre:** Ray `#EDEDED`, r8, padding 4, h32. Öğeler 12/600, h24, r8, pad `6px 16px`. Etkin öğe beyaz, pasif `#616161` ("All / Private / Shared").

### 7.3 Form kontrolleri (araç paneli)

- **Bölüm etiketi:** Yaklaşık 10 px, 600, BÜYÜK HARF, `#616161`. Sağda isteğe bağlı sayaç ("0/8").
- **Select:** Tam genişlik, h32, r8, bg `rgba(115,115,115,.05)`, kenarlık yok. Başta ikon, sonra değer (12/500), sağda ⌄.
- **Prompt alanı:** Beyaz kutu, 1 px `--primary-0` odak kenarlığı, r8 dış kutu. Metin 14/400 ve placeholder gri; iç padding `12px 12px 0`. Alt satırda sol tarafta "AI prompt" switch'i, sağ tarafta araç ikonları ve ✕.
- **Switch:** Yaklaşık 28×16. Açıkken `--primary-0` mavi, beyaz topuz (gözlem).
- **Stepper:** `− 4 +` biçiminde, bg `rgba(115,115,115,.05)`, h32, r8, değer ortada.
- **Parametre chip'i:** İkon + değer ("16:9", "5–6″", "ON"), bg `rgba(115,115,115,.05)`, h32, r8.
- **Referans / yükleme kutusu:** 65×65, 1 px **kesikli** `rgba(16,16,16,.1)`, bg `rgba(115,115,115,.05)`, r8. İçinde ikon ve 12 px etiket ("Style", "Character", "+ Add").
- **Araç başlık kartı:** Kategori pastel zemini (Image lavanta, Video mint, Audio açık camgöbeği), r12, h56–72. Üstte "‹ Tools" geri bağlantısı, altında araç adı (15/500) ve ⓘ ikonu, sağda "Templates" kare butonu.

### 7.4 Kartlar ve listeler

- **İçerik kartı:** Beyaz, r16, gölgesiz, padding 16–28.
- **Sonuç kartı:** Görsel üstte (r8). Alt satırda yorum, "Status" ve etiket ikonları var. Görsel üzerinde model ikonu ve "▷ 0:12" süre rozeti yer alır.
- **Sonuç grubu başlığı:** Solda prompt özeti (tek satır, "…" ile kesilir), sağda meta chip'ler ve checkbox ile göreli zaman ("2 weeks ago").
- **Meta chip:** h24, r4, 1 px `rgba(16,16,16,.1)`, bg `rgba(115,115,115,.05)`, 12/400, pad `0 8px`. Fazlası "+4" olarak gösterilir.
- **Proje kartı (Projects):** Yaklaşık 190×190, r12–16, gradyan veya kolaj kapak. Sol üstte kilit rozeti, sol altta ad (beyaz, kalın), sağ altta ⋮. "New project" kartı açık gri zeminli ve ortada ikon bulunur.
- **Kullanım senaryosu kartı (Explore):** Açık gri, r12. Sol üstte pembe "+ Flow" veya "Template" etiketi, sol altta kalın başlık (13–15 px), sağda medya.
- **Liste öğesi (sidebar):** h32, r8, pad `4px 16px`, 12/500, `#616161`, ikon + metin. Etkin öğe gri zeminli ve koyu metinli.
- **Proje listesi:** 12 px renkli kare ve ad. Sağ tarafta kilit/ekip ikonu veya pembe "UPGRADE" etiketi.

### 7.5 Menü (ölçüldü: "+" oluştur menüsü)

- Konteyner: 224 px genişlik, beyaz, r16, 1 px `rgba(16,16,16,.1)`, padding `8px 0`, çok katmanlı gölge (Bölüm 5).
- Öğe: h32, r8, pad `6px 8px 6px 4px`, 12/400, `#1A1A1A`. Başta 16 px ikon; kategori öğelerinde ikon kategori renginde.
- Yapı sırasıyla:
  1. Başlık satırı: proje seçici.
  2. Kategoriler: Space, Image, Video, Audio, Design, 3D.
  3. Ayırıcı.
  4. "+ New project" ve "Spaces templates".

### 7.6 Rozet ve etiketler

- **Bildirim sayacı:** Pembe daire, beyaz 8/700 rakam.
- **"New" etiketi:** Pembe metin, `rgba(255,88,174,.15)` zemin, küçük pill.
- **"UPGRADE" etiketi:** Pembe metin, açık pembe zemin, 10 px büyük harf.
- **Nokta rozeti:** Pembe nokta (Connections ikonunda).

### 7.7 Empty state

Ortalanmış yapı:
- 20–24 px çizgi ikon,
- başlık (yaklaşık 20/500, `#1A1A1A`),
- tek satır açıklama (12/400, `#616161`).

Önerilen aksiyon sayfa başlığındaki siyah butondur; empty state'e ayrıca buton konmaz (Library → Characters). Home'daki "Create a space" kartında ise çizim, başlık, açıklama ve küçük kenarlıklı "New space +" butonu vardır.

### 7.8 Onboarding toast

Altta ortalanmış beyaz pill. İçinde metin ("New here? Make your first generation"), mavi "Guided tour" pill butonu ve ✕ bulunur. Hafif gölgeli olduğu gözlemlendi.

---

## 8. İkonografi

- Çizgi (outline) ikon seti, yaklaşık 1.5 px çizgi. Boyutlar 16 (buton ve menü) ile 20 (rail).
- Rail ikonları etiketsizdir. Etkin öğe gri zeminle, pasif öğe `#1A1A1A` ikonla gösterilir.
- Kategori ikonları kategori rengindedir (Bölüm 2.4).
- "Generate" ve AI aksiyonlarında ✦ (sparkle) ikonu kullanılır.

---

## 9. Etkileşim ilkeleri (gözlem)

- **Tek oluşturma girişi:** Pembe "+" menüsü. Tüm araçlara Home ızgarası, rail kısayolları ve araç panelindeki pill sekmeler üzerinden de ulaşılır. Aynı hedefin birden çok yolu var, ama giriş noktası tek renkle (pembe) ayrılıyor.
- **Araç paneli yukarıdan aşağıya okunur:** kategori sekmesi → araç kartı → model → referanslar → prompt → parametreler → Generate. Birincil aksiyon her zaman panelin en altında ve tam genişliktedir.
- **Pasif birincil buton gri görünür:** Gerekli girdi yokken "Generate" gri kalır; renk yalnızca hazır olduğunda gelir.
- **Sonuçlar akış olarak sunulur:** Zamana göre gruplanır ve Layout ile Filters ile görünüm değiştirilir.
- **Kişiselleştirilmiş selamlama:** Home, günün saatine göre selamlama yapar ("Good afternoon…").

---

## 10. Token önerisi (CSS)

```css
:root {
  /* surfaces */
  --mg-bg-app: #F5F5F5;            /* kartların arkası */
  --mg-bg-workspace: #FAFAFA;      /* ana yüzey */
  --mg-bg-surface: #FFFFFF;        /* rail, kart, menü */
  --mg-bg-track: #EDEDED;          /* segmented rayı */
  --mg-bg-control: rgba(115,115,115,.05);
  --mg-bg-active: rgba(115,115,115,.15);
  --mg-bg-disabled: #E3E3E3;
  /* text */
  --mg-text-primary: #1A1A1A;
  --mg-text-strong: #0D0D0D;
  --mg-text-secondary: #616161;
  --mg-text-tertiary: #737373;
  /* lines */
  --mg-border: rgba(16,16,16,.1);
  --mg-border-subtle: rgba(16,16,16,.05);
  --mg-border-strong: rgba(16,16,16,.2);
  /* action */
  --mg-action-primary-bg: #1A1A1A;
  --mg-action-primary-fg: #FFFFFF;
  --mg-brand: #FF57AE;
  --mg-brand-soft: rgba(255,88,174,.15);
  --mg-focus: #3B6FE8;             /* hsl(222 81% 56%) */
  --mg-info: #506BF2;
  /* categories */
  --mg-cat-spaces: #8566DC;
  --mg-cat-image: #4F69F2;
  --mg-cat-video: #17CB8D;
  --mg-cat-audio: #00CDC6;
  --mg-cat-design: #CC7E80;
  --mg-cat-3d: #B39581;
  /* type */
  --mg-font-ui: 'Geist', Inter, system-ui, sans-serif;
  --mg-font-display: 'Klarheit', 'Geist', Inter, sans-serif;
  --mg-text-ui: 500 12px/18px var(--mg-font-ui);
  --mg-text-body: 400 14px/22.75px var(--mg-font-ui);
  --mg-text-title: 500 15px/24px var(--mg-font-ui);
  --mg-text-heading: 500 20px/30px var(--mg-font-ui);
  --mg-text-display: 500 28px/42px var(--mg-font-display);
  --mg-text-overline: 600 10px/15px var(--mg-font-ui); /* + uppercase */
  /* shape & size */
  --mg-radius-xs: 4px;
  --mg-radius-sm: 8px;
  --mg-radius-md: 12px;
  --mg-radius-lg: 16px;
  --mg-radius-pill: 9999px;
  --mg-control-h: 32px;
  --mg-control-h-lg: 40px;
  --mg-rail-w: 72px;
  --mg-shell-gap: 8px;
  --mg-shadow-overlay:
    0 0 2px rgba(18,18,18,.08), 0 25px 10px rgba(18,18,18,.02),
    0 14px 9px rgba(18,18,18,.02), 0 6px 6px rgba(18,18,18,.04),
    0 2px 4px rgba(18,18,18,.08);
}
.dark {
  --mg-bg-app: #0F0F0F;            /* --surface-0 */
  --mg-bg-surface: #1C1C1C;        /* --surface-1 */
  --mg-text-primary: #F7F7F7;      /* --surface-foreground-0 */
  --mg-text-secondary: #E6E6E6;    /* --surface-foreground-1 */
  --mg-border: rgba(255,255,255,.1);
  /* diğer dark değerleri siteden ölçülmedi — tasarım kararı gerekir */
}
```

---

## 11. Bizim Magnific dokümanımızla farklar

| Konu | magnific.com/app (ölçüldü) | Chyron Studio'da uygulanan (`magnific-design-system.md`) |
|---|---|---|
| UI fontu | Geist (başlık Klarheit) | Inter |
| Birincil buton | Siyah `#1A1A1A` | Mavi |
| Marka rengi | Pembe `#FF57AE` (oluştur ve upgrade) | Yok |
| Kontrol yüksekliği | 32 px (md), 40 px (lg) | 40 px (md), 48 px (lg) |
| Varsayılan UI metni | 12 / 500 | 14 / 500 |
| Input stili | Kenarlıksız, %5 gri dolgu | 1 px kenarlıklı, beyaz |
| Bölüm etiketleri | ~10 px BÜYÜK HARF | 14 px accordion başlığı |
| Kabuk | Zemin üstünde yüzen, 16 px köşeli kartlar (8 px boşluk) | Tam genişlik, kenarlıkla ayrılmış paneller |
| Rail | 72 px, etiketsiz ikonlar | 84 px, ikon + etiket |
| Sekmeler | Pill (gri ray, beyaz etkin) | Alt çizgili |
| Kartlar | Gölgesiz, tonla ayrım | Kenarlık + hafif gölge |
| Kategori renkleri | Her araç türünün bir tonu var | Yok |

**Sonuç:** Chyron Studio'ya uyguladığım sistem magnific.com'un tasarımı değil; tipografi, renk, yoğunluk ve kabuk yapısı belirgin biçimde farklı. Bilgi mimarisi ve bileşen kararları ise büyük ölçüde örtüşüyor: tek navigasyon rayı, sol araç paneli, tek birincil aksiyon ve menüye taşınmış ikincil aksiyonlar.
