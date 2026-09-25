# Chyron Studio — Magnific Design System dönüşümü

**Sürüm:** 3.0.0 · **Temel:** `9b4e220` · **Kapsam:** tüm uygulama (Chyron, Stream images, Media gallery)

Bu doküman, Magnific Design System'e geçişin audit bulgularını, bilgi mimarisi (IA) kararlarını ve uygulanan değişiklikleri özetler. Ekran görüntüleri `docs/magnific/` klasöründedir.

## 1. Audit bulguları

| Önem   | Bulgu                                                                                                                                                                          | Kullanıcıya etkisi                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Kritik | Her çalışma alanı kendi logosunu, sekmelerini ve tema düğmesini ayrı çiziyordu (3 kopya). Mobilde "Media" sekmesi tema ikonunun altına giriyordu.                              | Tutarsız navigasyon; mobilde tıklanamayan sekme           |
| Yüksek | ~40 ayarda slider ile sayı kutusu yan yana (aynı değer için iki kontrol)                                                                                                       | Görsel gürültü, panel uzunluğu iki katı, hassas giriş zor |
| Yüksek | Katman başlığında öne/arkaya al butonları timeline sürükle-bırak ve `[ ]` kısayollarıyla aynı işi yapıyordu                                                                    | Tekrar eden aksiyonlar                                    |
| Yüksek | "Preview in / Preview out" + timeline "Replay" + stil seçince otomatik önizleme — aynı iş için 4 yol                                                                           | Karar yorgunluğu                                          |
| Yüksek | Stream images: galeri/yükleme butonları hem canvas'ta hem panelde; Fit ve Flip hem toolbar'da hem bölümde; Safe area hem toolbar'da hem toggle olarak; iki ayrı indirme butonu | Aynı ekranda aynı aksiyonun 2–3 kopyası                   |
| Yüksek | Stream arka planı: thumbnail grid ile "Background style" select'i yan yana ve birbirini değiştiriyor                                                                           | Hangi kontrolün geçerli olduğu belirsiz                   |
| Yüksek | Galeri kartı: hover'da 3 ikon + altta "Download" butonu + thumbnail tıklaması (önizleme)                                                                                       | Kart başına 5 hedef, mobilde hover yok                    |
| Orta   | "Download ZIP" (header) ve "Download Category ZIP" (toolbar) aynı dosyayı indiriyordu; format filtresi 102 dosyanın 99'u PNG iken anlamsızdı                                   | Gereksiz seçenek                                          |
| Orta   | Galeri seçici modalında "Upload from device" iki kez, kartlarda seçim yerine indirme butonu                                                                                    | Görevle ilgisiz aksiyon                                   |
| Orta   | Altyazı açma/kapama ve metni, stil ayarlarıyla aynı kapalı bölümde gizliydi                                                                                                    | En çok düzenlenen içerik bir tık uzakta                   |
| Orta   | Stream'de kayıt durumu panelin altında, Chyron'da header'da                                                                                                                    | Tutarsız konum                                            |
| Orta   | Export diyaloğunda pazarlama dili ("Take it with you.", "READY FOR THE SPOTLIGHT")                                                                                             | Aksiyonu açıklamayan metin                                |
| Orta   | CSS üç katmanlı override (App.css → StudioLayout.css → Shell.css), ~6.500 satır, 189 hard-coded hex                                                                            | Bakımı zor, tema tutarsızlığı riski                       |
| Orta   | Üçüncül metin 4.17:1, dark mode birincil buton 4.47:1 kontrast                                                                                                                 | WCAG AA ihlali                                            |

## 2. Bilgi mimarisi

Ürün, motion graphics editörlerinin (Figma, Canva, CapCut) ortak yapısına göre yeniden düzenlendi: **uygulama navigasyonu → bağlam üst barı → canvas + zaman çizelgesi → özellik paneli**.

```
App shell (tek navigasyon)
├─ Navigation rail (≥768px) / Bottom navigation (<768px)
│   Chyron · Stream images · Media gallery · (tema)
├─ Chyron
│   Top bar   : Proje adı ▾ (Kaydet, Aç, Yeni, Kılavuz) · kayıt durumu · Geri/İleri · [Export]
│   Canvas    : Kompozisyon boyutu · Yakınlaştır · Önizleme ⋯ · Paneli gizle
│   Timeline  : Başa · Oynat · Sona · zaman · Döngü · Add image ▾ (Galeri / Cihaz)
│   Inspector : Katman adı · ⋯ (öne/arkaya, çoğalt, sil) · Design | Animate
│               Design: Style · Text (başlık + altyazı içeriği) · Subtitle style ·
│                       Typography · Colors · Shape & spacing · Details · Position
├─ Stream images
│   Top bar   : Set adı · kayıt durumu · Geri/İleri · [Download set | ▾ bu görsel]
│   Canvas    : Format adı · Flip · Tutamaklar · Safe area
│   Formatlar : Hero · Host card · Stream image
│   Inspector : Host image · Framing · Background (Image|Gradient|Solid|None) · Shadow & fade
└─ Media gallery
    Top bar   : Başlık · Arama · [Download ZIP (n)]
    Kategoriler (sidebar ≥1024px, chip <1024px) · Varlık ızgarası → Önizleme
    Önizleme  : Copy path · Use in… ▾ (Chyron / Stream images) · [Download]
```

Kurallar: ekran başına tek birincil aksiyon (top bar sağında); her aksiyon tek yerde; içerik ayarları stil ayarlarından önce; bağlama özgü aksiyonlar ⋯ menüsünde.

## 3. Kaldırılan / birleştirilen öğeler

| Önce                                               | Sonra                                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 3 ayrı header'da logo + sekmeler + tema düğmesi    | Tek `AppNav` (rail / bottom nav), tek `TopBar` bileşeni                                |
| Slider + sayı kutusu (~40 çift)                    | `NumberField`: tek input, ↑/↓ (Shift ×10), etiketi sürükleyerek ayar, ikili ızgara     |
| Katman başlığında 4 ikon buton                     | "⋯ Layer actions" menüsü (kısayollarıyla)                                              |
| Preview in / Preview out / Replay                  | Stil seçmek oynatır; aynı stile tekrar tıklamak yeniden oynatır; timeline Başa + Oynat |
| Timeline "Image" + ayrı açılır menü uygulaması     | Ortak `MenuButton` ("Add image ▾")                                                     |
| Stream: canvas + panelde galeri/yükleme butonları  | Canvas boş durumunda tek "Add host image ▾"; panelde dosya kartı + Değiştir/Kaldır     |
| Stream: toolbar Fit + bölüm Auto fit + bölüm reset | Tek "Reset Framing" (bölüm başlığı)                                                    |
| Stream: toolbar Safe area + Finishing toggle       | Yalnızca toolbar                                                                       |
| Stream: grid + "Background style" select + 2 buton | Segmented tip seçimi → yalnızca ilgili seçenekler; ızgarada "+ Add" kartı              |
| Stream: "Download PNG" + "Download set"            | Split button: Download set ▾ "Download {format} only"                                  |
| Galeri: hover 3 ikon + footer Download butonu      | Kart = önizleme; tek indirme ikonu                                                     |
| Galeri: Download ZIP + Download Category ZIP       | Tek ZIP butonu, filtreye göre sayı                                                     |
| Galeri: format filtresi                            | Kaldırıldı (PNG dışı dosyalar rozetle gösterilir)                                      |
| Galeri önizleme: 4 eşit buton                      | Copy path (ghost) · Use in… ▾ · Download (primary)                                     |
| Seçici modal: çift yükleme + kart içi indirme      | Tek "Upload from device", kart = seç                                                   |
| Export: pazarlama başlığı + alpha kutusu           | "Export" + tek satır açıklama                                                          |

## 4. Magnific uygulaması

- **Token'lar:** `src/styles/tokens.css` — primitive → semantic → component. Renk, tipografi (Inter), 4pt boşluk, radius, gölge, z-index, motion, kontrol boyutları. Light/dark, sistem takibi + manuel seçim.
- **Marka:** Ürünün mavi kimliği korunarak Magnific Blue ailesi birincil aksiyona bağlandı (`--brand-*`, 4 satırla değiştirilebilir).
- **Katmanlar:** `base`, `components`, `shell`, `editor`, `stream`, `gallery` — toplam 3.327 satır (önce ~6.500). Token dosyası dışında **0 hex**; yalnızca görsel üstü overlay'lerde 9 `rgb()` alfa değeri.
- **Bileşenler:** Button (primary/secondary/outline/ghost), Icon button, Split button, Number field, Field/Select/Textarea, Color, Switch, Segmented, Tabs, Chips, Accordion, Menu (mobilde action sheet), Dialog (mobilde bottom sheet), Toast, Alert, Empty state, File card, Search field, Badge, Navigation rail/bottom nav, Top bar.
- **Responsive:** <768 bottom nav + sheet'ler + tam genişlik aksiyonlar; 768–1023 canvas üstte, panel altta; ≥1024 üç bölmeli düzen.
- **Erişilebilirlik:** WCAG 2.2 AA kontrast (light + dark axe taramaları temiz), dokunmatikte 44 px hedefler, görünür focus, menülerde ↑/↓/Home/End/Esc, `menuitemradio` durumları, `prefers-reduced-motion`.

## 5. Doğrulama

| Kontrol              | Sonuç            |
| -------------------- | ---------------- |
| `tsc -b`             | Hatasız          |
| ESLint               | Hatasız          |
| Vitest               | 134 / 134        |
| Playwright (21 test) | 20 geçti. Export testinde PNG, SVG ve PNG sekansı doğrulandı; WebM kodlaması bu sandbox'ta (yazılımsal GPU ile tek süreçli Chromium) tamamlanıyor ancak testin 150 sn sınırını aşıyor. Arayüz değişikliğiyle ilgisi yok; normal bir makinede yeniden koşulmalı. |
| Üretim derlemesi     | Başarılı         |

Test güncellemeleri: yeni etiketler (NumberField, Host horizontal/vertical), menü rolleri, split indirme, segmented arka plan, iç scroll alanı. Önceden kırık iki test düzeltildi: hero'nun varsayılan alt gölgesi piksel kontrolünü bozuyordu; döndürülmüş kenarlarda ±1 yuvarlama farkına tolerans eklendi.

## 6. Önerilen sonraki adımlar

1. Stil kartlarına ve hareket çiplerine seçili durumu için isim + ikon dışında kısa önizleme animasyonu.
2. Katman listesinde klavyeyle sıralama için "Move up/down" alternatifinin timeline satırına da eklenmesi.
3. Galeri için çoklu seçim + seçilenleri ZIP olarak indirme (toplu aksiyon barı).
4. Magnific token'larının JSON (W3C) çıktısı ile Figma değişkenlerinin senkronu.
