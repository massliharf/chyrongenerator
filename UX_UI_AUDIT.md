# Chyron Studio — UX/UI audit ve uygulanan iyileştirmeler

**Sürüm:** 2.2.0 · **Tarih:** 22 Eylül 2026 · **Karşılaştırma:** `4aa5df0` → 2.2.0

Editör; okunabilirlik, ayarları bulma, mobil kullanım, klavye erişimi, hata kurtarma ve export akışları açısından incelendi. Bulgular bu sürümde kod üzerinde giderildi. Varsayılan **720 × 1280 / 720p**, ortak **1 saniyelik intro/outro** ve alpha export akışı korundu.

## Ölçülen sonuçlar

| Kontrol                                                        | Önce      | Sonra                                  |
| -------------------------------------------------------------- | --------- | -------------------------------------- |
| Masaüstünde örneklenen görünür etiketlerden 12 px altındakiler | 14        | 0                                      |
| Masaüstünde görünür düğmelerden 48 × 48 px altındakiler        | 25        | 0                                      |
| 320 px ekranda yatay taşma                                     | 40 px     | 0 px                                   |
| Yedi ekran boyutunda yatay taşma                               | —         | 0 px                                   |
| 320 px genişlikte %200 metin büyütme                           | —         | Yatay taşma yok; başlık düzenlenebilir |
| Üretim derlemesinde yedi axe taraması                          | Ölçülmedi | Tespit edilen ihlal yok                |
| Üretim önizlemesinde JavaScript hatası                         | Ölçülmedi | Tespit edilmedi                        |

Ölçümler aynı varsayılan proje üzerinden yapıldı. Etiket ve düğme sayıları, ölçüm anındaki görünür arayüz örneklerini kapsar; tüm olası durumların sayımı değildir. Önceki ölçümler [baseline.json](docs/audit/baseline.json), son ölçümler [verification.json](docs/audit/verification.json) dosyasındadır.

## Bulgular ve uygulanan çözümler

| Öncelik | Bulgu ve kullanıcı etkisi                                                                 | Uygulanan çözüm                                                                                                                                                               |
| ------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Yüksek  | 10–11 px metinler ve küçük düğmeler okumayı ve dokunmayı zorlaştırıyordu.                 | Material 3 boyut/satır yüksekliği rolleri, en az 12 px yardımcı metin, 48 px etkileşim alanları ve belirgin klavye odağı.                                                     |
| Yüksek  | 360 px minimum sayfa genişliği, 320 px cihazda taşmaya neden oluyordu.                    | 320 px başlangıç genişliği; masaüstü, tablet, telefon ve kısa yatay ekran için uyarlanan düzen.                                                                               |
| Yüksek  | Uzun ayar listeleri ve sürekli açık şablon sütunu tuval alanını daraltıyordu.             | 12 açılır/kapanır ayar grubu, canlı özetler, tüm ayarlarda arama, toplu aç/kapat, daraltılabilen timeline ve aramalı şablon penceresi.                                        |
| Yüksek  | Global Space kısayolu, odaktaki düğmenin doğal klavye davranışını engelleyebiliyordu.     | Düğme ve diğer etkileşimli kontrollerde doğal davranış; sekmeler ve export seçeneklerinde yön tuşları, Home/End; pencere kapanınca odağın geri dönmesi.                       |
| Yüksek  | Telefon ekranında tam portre kadraj, düzenlenen yazıyı çok küçük gösteriyordu.            | Design/Motion için etiketli yakın görünüm; tek düğmeyle tam kadraja dönüş. Canvas sekmesi ve odak modu tam kadrajı gösterir. Bu yakınlaştırma export boyutlarını değiştirmez. |
| Yüksek  | Mobil export penceresinde birincil eylem uzun içeriğin altında kalabiliyordu.             | Kaydırılan seçenek alanından ayrı alt bölüm; export düğmesi görünür kalır.                                                                                                    |
| Orta    | Sayısal değerler yazarken erken sınırlandırma, çok basamaklı sayı girişini bozabiliyordu. | Geçici giriş korunur; aralık dışı değer alan terk edildiğinde sınırlandırılır. Enter ile tamamlanır, Escape ile geçici giriş bırakılır.                                       |
| Orta    | Renk alanlarında tam HEX değeri girmek mümkün değildi.                                    | 3/6 basamaklı HEX girişi, renk seçici ve alan içi hata açıklaması.                                                                                                            |
| Orta    | Tipografi ve kompozisyon özelleştirmeleri sınırlıydı.                                     | Büyük/küçük/orijinal harf kullanımı, Typography modunda harf aralığı, pillsiz alt başlık, kompozisyon dönüşü ve grup opaklığı.                                                |
| Orta    | Özel çıktı boyutları ve oranlı yeniden boyutlandırma yeterince doğrudan değildi.          | Genişlik/yükseklik alanları, oran kilidi, boyutları değiştirme ve hızlı hizalama.                                                                                             |
| Orta    | Şablon seçimi daha önce ayarlanmış proje özelliklerini değiştirebiliyordu.                | Metin, tuval, zamanlama, konum ve opaklık korunarak şablon uygulanır.                                                                                                         |
| Orta    | Panel durumlarının yeniden kurulması ve preset silme işlemi gereksiz tekrar yaratıyordu.  | Panel/timeline tercihlerinin saklanması; preset silme için 12 saniyelik geri alma; ayar grubu sıfırlamalarının undo geçmişine katılması.                                      |
| Orta    | Yeni opaklık özelliğinde katmanlara ayrı uygulama, çakışan alanları koyulaştırabilirdi.   | Opaklık tamamlanmış kompozisyona bir kez uygulanır. PNG ve SVG sonuçları aynı grup opaklığını kullanır.                                                                       |

## Tipografi eşlemesi

Material 3'ün boyut/satır yüksekliği ölçeği web için `rem` değişkenlerine uyarlandı. Arayüz yazı tipi Inter olarak korundu. Aşağıdaki değerler 16 px kök boyutta geçerlidir; kullanıcının tasarladığı chyron metninin boyutu ayrı kontrollerle ayarlanır.

| Rol            | Boyut / satır yüksekliği | Kullanım                                    |
| -------------- | ------------------------ | ------------------------------------------- |
| Headline small | 24 / 32 px               | Export ve yardım penceresi başlıkları       |
| Title large    | 22 / 28 px               | Marka ve şablon penceresi başlığı           |
| Title medium   | 16 / 24 px               | İkincil başlıklar ve mobil pencere başlığı  |
| Title small    | 14 / 20 px               | Ayar grupları, kart başlıkları              |
| Body large     | 16 / 24 px               | Metin alanları, arama ve sayısal girişler   |
| Body medium    | 14 / 20 px               | Genel arayüz açıklamaları                   |
| Body small     | 12 / 16 px               | İpuçları, ayar özetleri, kayıt durumu       |
| Label large    | 14 / 20 px               | Düğmeler, sekmeler, alan etiketleri         |
| Label medium   | 12 / 16 px               | Zaman kodu, ölçüler, küçük durum etiketleri |

48 dp dokunma hedefi önerisi bu web uygulamasında **48 CSS px** olarak uyarlandı. Bu iki birim farklı platformlara aittir. Renkler okunabilir koyu yüzeyler, açık metin ve belirgin seçili/odak durumları için yeniden düzenlendi.

## Responsive davranış

| Genişlik / koşul | Düzen                                                                        |
| ---------------- | ---------------------------------------------------------------------------- |
| 900 px ve üzeri  | Geniş tuval ve sağda ayar paneli; şablonlar ayrı pencerede                   |
| 600–899 px       | Önizleme üstte, bağımsız kaydırılan ayarlar altta; ayar grupları iki sütunda |
| 320–599 px       | İki satırlı üst çubuk, tek sütun ayarlar, 48 px kontroller ve yakın önizleme |
| Kısa yatay ekran | İçeriğin erişilebilir kalması için dikey sayfa kaydırması                    |
| Focus canvas     | Ayar paneli kapanır, tam kadraja ayrılan alan büyür                          |

Kontrol edilen ekranlar: **1440 × 960, 1024 × 768, 768 × 1024, 393 × 852, 360 × 740, 320 × 900 ve 844 × 390**. Bu örneklerde görünür düğmelerin hedef boyutu ve yatay taşma kontrol edildi.

## Doğrulama

| Kontrol                          | Sonuç / kapsam                                                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript, ESLint, üretim build | Başarılı                                                                                                                                       |
| Birim testleri                   | 29 test başarılı: varsayılanlar, doğrulama, migrasyon, şablon uygulama, animasyon simetrisi ve frame sınırları                                 |
| Tarayıcı senaryoları             | 8 senaryo doğrulandı: düzenleme, kalıcılık, undo, intro/outro, gerçek indirmeler, iptal/yeniden export, yeni özelleştirmeler ve UX kontrolleri |
| Alpha export                     | PNG, SVG, PNG sequence ZIP, VP9 WebM ve ProRes 4444 gerçek dosya indirmeleri kontrol edildi                                                    |
| Video alpha                      | İndirilen videolar FFmpeg ile çözülerek şeffaf ilk/son kare, opak içerik, kısmi alpha, boyut ve frame sayısı kontrol edildi                    |
| Grup opaklığı                    | %50 opaklıklı PNG'nin en yüksek alpha değeri 127–128/255; SVG'de `opacity="0.5"` ve dönüş bilgisi doğrulandı                                   |
| Üretim sürümünde axe             | Design, Motion, Canvas, renk kontrolleri, masaüstü export, mobil export ve mobil şablon penceresinde ihlal bulunmadı                           |
| Klavye                           | Space, sekme/radyo yön tuşları, Escape ve pencere sonrası odak dönüşü kontrol edildi                                                           |
| %200 metin                       | 320 px genişlikte kök yazı boyutu 32 px yapılarak düzenleme ve taşma kontrol edildi                                                            |

Tekrarlamak için:

```bash
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
```

Tarayıcı testleri için sistemde `ffmpeg` ve `ffprobe` gerekir. Hazır Chromium kullanılıyorsa `CHYRON_CHROMIUM_PATH` tanımlanabilir. Senaryolar [studio.spec.ts](tests/browser/studio.spec.ts), [ux.spec.ts](tests/browser/ux.spec.ts) ve [motion.test.ts](tests/motion.test.ts) dosyalarındadır.

Bu çalışma Chromium otomasyonu ve ekran görüntüsü incelemesine dayanır. Gerçek cihazda iOS/Safari, Firefox, ekran okuyucu ile kullanım ve işletim sisteminin sanal klavye davranışı bu doğrulamanın kapsamına dahil değildir. Axe sonucu tam WCAG uygunluğu sertifikası anlamına gelmez. %200 testi metin büyütmeyi simüle eder; tüm tarayıcı zoom davranışlarını kapsamaz. Video belleği ve frame sınırları [README](README.md#export-formats) içinde açıklanmıştır.

## Görsel kanıtlar

| Görünüm         | Önce                                             | Sonra                                                    |
| --------------- | ------------------------------------------------ | -------------------------------------------------------- |
| Masaüstü        | [Ekran görüntüsü](docs/audit/before-desktop.png) | [Ekran görüntüsü](docs/audit/after-desktop.png)          |
| Telefon         | [Ekran görüntüsü](docs/audit/before-mobile.png)  | [Ekran görüntüsü](docs/audit/after-mobile.png)           |
| Tablet          | —                                                | [Ekran görüntüsü](docs/audit/after-tablet.png)           |
| 320 px          | —                                                | [Ekran görüntüsü](docs/audit/after-narrow.png)           |
| Mobil export    | —                                                | [Ekran görüntüsü](docs/audit/after-mobile-export.png)    |
| Mobil şablonlar | —                                                | [Ekran görüntüsü](docs/audit/after-mobile-templates.png) |
| %200 metin      | —                                                | [Ekran görüntüsü](docs/audit/text-200-percent.png)       |

## Tasarım referansları

- [Google — Material 3 tipografi ölçeği](https://developer.android.com/develop/ui/compose/designsystems/material3#typography)
- [Google — Dokunma hedefi boyutu](https://support.google.com/accessibility/android/answer/7101858?hl=en)
- [W3C — WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C — WCAG hızlı referansı](https://www.w3.org/WAI/WCAG22/quickref/)
