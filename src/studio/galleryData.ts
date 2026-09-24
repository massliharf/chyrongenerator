import { zipSync } from 'fflate'

export interface GalleryItem {
  id: string
  category: string
  name: string
  filename: string
  path: string
}

export const GALLERY_ITEMS: GalleryItem[] = [
  {
    "id": "Backgrounds_1-1_png",
    "category": "Backgrounds",
    "name": "1-1",
    "filename": "1-1.png",
    "path": "gallery/Backgrounds/1-1.png"
  },
  {
    "id": "Backgrounds_1_png",
    "category": "Backgrounds",
    "name": "1",
    "filename": "1.png",
    "path": "gallery/Backgrounds/1.png"
  },
  {
    "id": "Backgrounds_2-1_png",
    "category": "Backgrounds",
    "name": "2-1",
    "filename": "2-1.png",
    "path": "gallery/Backgrounds/2-1.png"
  },
  {
    "id": "Backgrounds_2_png",
    "category": "Backgrounds",
    "name": "2",
    "filename": "2.png",
    "path": "gallery/Backgrounds/2.png"
  },
  {
    "id": "Backgrounds_3-1_png",
    "category": "Backgrounds",
    "name": "3-1",
    "filename": "3-1.png",
    "path": "gallery/Backgrounds/3-1.png"
  },
  {
    "id": "Backgrounds_3_png",
    "category": "Backgrounds",
    "name": "3",
    "filename": "3.png",
    "path": "gallery/Backgrounds/3.png"
  },
  {
    "id": "Game_Modes_savvy_subtext_png",
    "category": "Game Modes",
    "name": "savvy_subtext",
    "filename": "savvy_subtext.png",
    "path": "gallery/Game%20Modes/savvy_subtext.png"
  },
  {
    "id": "Game_Modes_savvy_textchain_png",
    "category": "Game Modes",
    "name": "savvy_textchain",
    "filename": "savvy_textchain.png",
    "path": "gallery/Game%20Modes/savvy_textchain.png"
  },
  {
    "id": "Game_Modes_subtex_336x156_png",
    "category": "Game Modes",
    "name": "subtex_336x156",
    "filename": "subtex_336x156.png",
    "path": "gallery/Game%20Modes/subtex_336x156.png"
  },
  {
    "id": "Game_Modes_textchain_336x156_png",
    "category": "Game Modes",
    "name": "textchain_336x156",
    "filename": "textchain_336x156.png",
    "path": "gallery/Game%20Modes/textchain_336x156.png"
  },
  {
    "id": "Glasses_variations_overview_png",
    "category": "Glasses variations",
    "name": "overview",
    "filename": "overview.png",
    "path": "gallery/Glasses%20variations/overview.png"
  },
  {
    "id": "Glasses_variations_png_big-pupils_png",
    "category": "Glasses variations",
    "name": "big-pupils",
    "filename": "big-pupils.png",
    "path": "gallery/Glasses%20variations/png/big-pupils.png"
  },
  {
    "id": "Glasses_variations_png_bottom-left_png",
    "category": "Glasses variations",
    "name": "bottom-left",
    "filename": "bottom-left.png",
    "path": "gallery/Glasses%20variations/png/bottom-left.png"
  },
  {
    "id": "Glasses_variations_png_bottom-right_png",
    "category": "Glasses variations",
    "name": "bottom-right",
    "filename": "bottom-right.png",
    "path": "gallery/Glasses%20variations/png/bottom-right.png"
  },
  {
    "id": "Glasses_variations_png_bottom_png",
    "category": "Glasses variations",
    "name": "bottom",
    "filename": "bottom.png",
    "path": "gallery/Glasses%20variations/png/bottom.png"
  },
  {
    "id": "Glasses_variations_png_center-left_png",
    "category": "Glasses variations",
    "name": "center-left",
    "filename": "center-left.png",
    "path": "gallery/Glasses%20variations/png/center-left.png"
  },
  {
    "id": "Glasses_variations_png_center-right_png",
    "category": "Glasses variations",
    "name": "center-right",
    "filename": "center-right.png",
    "path": "gallery/Glasses%20variations/png/center-right.png"
  },
  {
    "id": "Glasses_variations_png_center_png",
    "category": "Glasses variations",
    "name": "center",
    "filename": "center.png",
    "path": "gallery/Glasses%20variations/png/center.png"
  },
  {
    "id": "Glasses_variations_png_cross-eyed_png",
    "category": "Glasses variations",
    "name": "cross-eyed",
    "filename": "cross-eyed.png",
    "path": "gallery/Glasses%20variations/png/cross-eyed.png"
  },
  {
    "id": "Glasses_variations_png_dead_png",
    "category": "Glasses variations",
    "name": "dead",
    "filename": "dead.png",
    "path": "gallery/Glasses%20variations/png/dead.png"
  },
  {
    "id": "Glasses_variations_png_excited_png",
    "category": "Glasses variations",
    "name": "excited",
    "filename": "excited.png",
    "path": "gallery/Glasses%20variations/png/excited.png"
  },
  {
    "id": "Glasses_variations_png_hearts_png",
    "category": "Glasses variations",
    "name": "hearts",
    "filename": "hearts.png",
    "path": "gallery/Glasses%20variations/png/hearts.png"
  },
  {
    "id": "Glasses_variations_png_top-left_png",
    "category": "Glasses variations",
    "name": "top-left",
    "filename": "top-left.png",
    "path": "gallery/Glasses%20variations/png/top-left.png"
  },
  {
    "id": "Glasses_variations_png_top-right_png",
    "category": "Glasses variations",
    "name": "top-right",
    "filename": "top-right.png",
    "path": "gallery/Glasses%20variations/png/top-right.png"
  },
  {
    "id": "Glasses_variations_png_top_png",
    "category": "Glasses variations",
    "name": "top",
    "filename": "top.png",
    "path": "gallery/Glasses%20variations/png/top.png"
  },
  {
    "id": "Glasses_variations_svg_glasses-variants_svg",
    "category": "Glasses variations",
    "name": "glasses-variants",
    "filename": "glasses-variants.svg",
    "path": "gallery/Glasses%20variations/svg/glasses-variants.svg"
  },
  {
    "id": "Host_Images_scott1246_2_png",
    "category": "Host Images",
    "name": "scott1246 2",
    "filename": "scott1246 2.png",
    "path": "gallery/Host%20Images/scott1246%202.png"
  },
  {
    "id": "Host_Images_scott1258_2_png",
    "category": "Host Images",
    "name": "scott1258 2",
    "filename": "scott1258 2.png",
    "path": "gallery/Host%20Images/scott1258%202.png"
  },
  {
    "id": "Host_Images_scott1259_2_png",
    "category": "Host Images",
    "name": "scott1259 2",
    "filename": "scott1259 2.png",
    "path": "gallery/Host%20Images/scott1259%202.png"
  },
  {
    "id": "Host_Images_scott1265_2_png",
    "category": "Host Images",
    "name": "scott1265 2",
    "filename": "scott1265 2.png",
    "path": "gallery/Host%20Images/scott1265%202.png"
  },
  {
    "id": "Host_Images_scott1268_2_png",
    "category": "Host Images",
    "name": "scott1268 2",
    "filename": "scott1268 2.png",
    "path": "gallery/Host%20Images/scott1268%202.png"
  },
  {
    "id": "Host_Images_scott1269_2_png",
    "category": "Host Images",
    "name": "scott1269 2",
    "filename": "scott1269 2.png",
    "path": "gallery/Host%20Images/scott1269%202.png"
  },
  {
    "id": "Host_Images_scott1274_2_png",
    "category": "Host Images",
    "name": "scott1274 2",
    "filename": "scott1274 2.png",
    "path": "gallery/Host%20Images/scott1274%202.png"
  },
  {
    "id": "Host_Images_scott1292_2_png",
    "category": "Host Images",
    "name": "scott1292 2",
    "filename": "scott1292 2.png",
    "path": "gallery/Host%20Images/scott1292%202.png"
  },
  {
    "id": "Host_Images_scott1293_2_png",
    "category": "Host Images",
    "name": "scott1293 2",
    "filename": "scott1293 2.png",
    "path": "gallery/Host%20Images/scott1293%202.png"
  },
  {
    "id": "Host_Images_scott1294_2_png",
    "category": "Host Images",
    "name": "scott1294 2",
    "filename": "scott1294 2.png",
    "path": "gallery/Host%20Images/scott1294%202.png"
  },
  {
    "id": "Host_Images_scott1300_2_png",
    "category": "Host Images",
    "name": "scott1300 2",
    "filename": "scott1300 2.png",
    "path": "gallery/Host%20Images/scott1300%202.png"
  },
  {
    "id": "Host_Images_scott1303_2_png",
    "category": "Host Images",
    "name": "scott1303 2",
    "filename": "scott1303 2.png",
    "path": "gallery/Host%20Images/scott1303%202.png"
  },
  {
    "id": "Host_Images_scott1308_2_png",
    "category": "Host Images",
    "name": "scott1308 2",
    "filename": "scott1308 2.png",
    "path": "gallery/Host%20Images/scott1308%202.png"
  },
  {
    "id": "Host_Images_scott1309_2_png",
    "category": "Host Images",
    "name": "scott1309 2",
    "filename": "scott1309 2.png",
    "path": "gallery/Host%20Images/scott1309%202.png"
  },
  {
    "id": "Host_Images_scott1324_2_png",
    "category": "Host Images",
    "name": "scott1324 2",
    "filename": "scott1324 2.png",
    "path": "gallery/Host%20Images/scott1324%202.png"
  },
  {
    "id": "Host_Images_scott1332_2_png",
    "category": "Host Images",
    "name": "scott1332 2",
    "filename": "scott1332 2.png",
    "path": "gallery/Host%20Images/scott1332%202.png"
  },
  {
    "id": "Host_Images_scott1333_2_png",
    "category": "Host Images",
    "name": "scott1333 2",
    "filename": "scott1333 2.png",
    "path": "gallery/Host%20Images/scott1333%202.png"
  },
  {
    "id": "Host_Images_scott1334_2_png",
    "category": "Host Images",
    "name": "scott1334 2",
    "filename": "scott1334 2.png",
    "path": "gallery/Host%20Images/scott1334%202.png"
  },
  {
    "id": "Host_Images_scott1335_2_png",
    "category": "Host Images",
    "name": "scott1335 2",
    "filename": "scott1335 2.png",
    "path": "gallery/Host%20Images/scott1335%202.png"
  },
  {
    "id": "Host_Images_scott1341_2_png",
    "category": "Host Images",
    "name": "scott1341 2",
    "filename": "scott1341 2.png",
    "path": "gallery/Host%20Images/scott1341%202.png"
  },
  {
    "id": "Host_Images_scott1376_3_png",
    "category": "Host Images",
    "name": "scott1376 3",
    "filename": "scott1376 3.png",
    "path": "gallery/Host%20Images/scott1376%203.png"
  },
  {
    "id": "Host_Images_scott1377_3_png",
    "category": "Host Images",
    "name": "scott1377 3",
    "filename": "scott1377 3.png",
    "path": "gallery/Host%20Images/scott1377%203.png"
  },
  {
    "id": "Host_Images_scott1380_2_png",
    "category": "Host Images",
    "name": "scott1380 2",
    "filename": "scott1380 2.png",
    "path": "gallery/Host%20Images/scott1380%202.png"
  },
  {
    "id": "Host_Images_scott1381_2_png",
    "category": "Host Images",
    "name": "scott1381 2",
    "filename": "scott1381 2.png",
    "path": "gallery/Host%20Images/scott1381%202.png"
  },
  {
    "id": "Host_Images_scott1393_2_png",
    "category": "Host Images",
    "name": "scott1393 2",
    "filename": "scott1393 2.png",
    "path": "gallery/Host%20Images/scott1393%202.png"
  },
  {
    "id": "Host_Images_scott1395_2_png",
    "category": "Host Images",
    "name": "scott1395 2",
    "filename": "scott1395 2.png",
    "path": "gallery/Host%20Images/scott1395%202.png"
  },
  {
    "id": "Host_Images_scott1398_2_png",
    "category": "Host Images",
    "name": "scott1398 2",
    "filename": "scott1398 2.png",
    "path": "gallery/Host%20Images/scott1398%202.png"
  },
  {
    "id": "Host_Images_scott1399_2_png",
    "category": "Host Images",
    "name": "scott1399 2",
    "filename": "scott1399 2.png",
    "path": "gallery/Host%20Images/scott1399%202.png"
  },
  {
    "id": "Host_Images_scott1401_2_png",
    "category": "Host Images",
    "name": "scott1401 2",
    "filename": "scott1401 2.png",
    "path": "gallery/Host%20Images/scott1401%202.png"
  },
  {
    "id": "Host_Images_scott1404_2_png",
    "category": "Host Images",
    "name": "scott1404 2",
    "filename": "scott1404 2.png",
    "path": "gallery/Host%20Images/scott1404%202.png"
  },
  {
    "id": "Host_Images_scott1408_2_png",
    "category": "Host Images",
    "name": "scott1408 2",
    "filename": "scott1408 2.png",
    "path": "gallery/Host%20Images/scott1408%202.png"
  },
  {
    "id": "Host_Images_scott1413_2_png",
    "category": "Host Images",
    "name": "scott1413 2",
    "filename": "scott1413 2.png",
    "path": "gallery/Host%20Images/scott1413%202.png"
  },
  {
    "id": "Host_Images_scott1434_2_png",
    "category": "Host Images",
    "name": "scott1434 2",
    "filename": "scott1434 2.png",
    "path": "gallery/Host%20Images/scott1434%202.png"
  },
  {
    "id": "Host_Images_scott1442_2_png",
    "category": "Host Images",
    "name": "scott1442 2",
    "filename": "scott1442 2.png",
    "path": "gallery/Host%20Images/scott1442%202.png"
  },
  {
    "id": "Host_Images_scott1443_2_png",
    "category": "Host Images",
    "name": "scott1443 2",
    "filename": "scott1443 2.png",
    "path": "gallery/Host%20Images/scott1443%202.png"
  },
  {
    "id": "Host_Images_scott1444_2_png",
    "category": "Host Images",
    "name": "scott1444 2",
    "filename": "scott1444 2.png",
    "path": "gallery/Host%20Images/scott1444%202.png"
  },
  {
    "id": "Host_Images_scott1452_2_png",
    "category": "Host Images",
    "name": "scott1452 2",
    "filename": "scott1452 2.png",
    "path": "gallery/Host%20Images/scott1452%202.png"
  },
  {
    "id": "Host_Images_scott1453_2_png",
    "category": "Host Images",
    "name": "scott1453 2",
    "filename": "scott1453 2.png",
    "path": "gallery/Host%20Images/scott1453%202.png"
  },
  {
    "id": "Host_Images_scott1456_2_png",
    "category": "Host Images",
    "name": "scott1456 2",
    "filename": "scott1456 2.png",
    "path": "gallery/Host%20Images/scott1456%202.png"
  },
  {
    "id": "Host_Images_scott1473_2_png",
    "category": "Host Images",
    "name": "scott1473 2",
    "filename": "scott1473 2.png",
    "path": "gallery/Host%20Images/scott1473%202.png"
  },
  {
    "id": "Host_Images_scott1475_2_png",
    "category": "Host Images",
    "name": "scott1475 2",
    "filename": "scott1475 2.png",
    "path": "gallery/Host%20Images/scott1475%202.png"
  },
  {
    "id": "Host_Images_scott1508_2_png",
    "category": "Host Images",
    "name": "scott1508 2",
    "filename": "scott1508 2.png",
    "path": "gallery/Host%20Images/scott1508%202.png"
  },
  {
    "id": "Host_Images_scott1513_2_png",
    "category": "Host Images",
    "name": "scott1513 2",
    "filename": "scott1513 2.png",
    "path": "gallery/Host%20Images/scott1513%202.png"
  },
  {
    "id": "Logo_Archived_LI-banner_png",
    "category": "Logo",
    "name": "LI-banner",
    "filename": "LI-banner.png",
    "path": "gallery/Logo/Archived/LI-banner.png"
  },
  {
    "id": "Logo_Archived_app-icon-beta_png",
    "category": "Logo",
    "name": "app-icon-beta",
    "filename": "app-icon-beta.png",
    "path": "gallery/Logo/Archived/app-icon-beta.png"
  },
  {
    "id": "Logo_Archived_app-icon_png",
    "category": "Logo",
    "name": "app-icon",
    "filename": "app-icon.png",
    "path": "gallery/Logo/Archived/app-icon.png"
  },
  {
    "id": "Logo_Archived_blank-background_png",
    "category": "Logo",
    "name": "blank-background",
    "filename": "blank-background.png",
    "path": "gallery/Logo/Archived/blank-background.png"
  },
  {
    "id": "Logo_Archived_glasses-outline_png",
    "category": "Logo",
    "name": "glasses-outline",
    "filename": "glasses-outline.png",
    "path": "gallery/Logo/Archived/glasses-outline.png"
  },
  {
    "id": "Logo_Archived_glasses_png",
    "category": "Logo",
    "name": "glasses",
    "filename": "glasses.png",
    "path": "gallery/Logo/Archived/glasses.png"
  },
  {
    "id": "Logo_Archived_icon-large_png",
    "category": "Logo",
    "name": "icon-large",
    "filename": "icon-large.png",
    "path": "gallery/Logo/Archived/icon-large.png"
  },
  {
    "id": "Logo_Archived_logo-black-text_png",
    "category": "Logo",
    "name": "logo-black-text",
    "filename": "logo-black-text.png",
    "path": "gallery/Logo/Archived/logo-black-text.png"
  },
  {
    "id": "Logo_Archived_logo-text-savvy_svg",
    "category": "Logo",
    "name": "logo-text-savvy",
    "filename": "logo-text-savvy.svg",
    "path": "gallery/Logo/Archived/logo-text-savvy.svg"
  },
  {
    "id": "Logo_Archived_logo-white-text_png",
    "category": "Logo",
    "name": "logo-white-text",
    "filename": "logo-white-text.png",
    "path": "gallery/Logo/Archived/logo-white-text.png"
  },
  {
    "id": "Logo_Archived_text-savvy-logo_png",
    "category": "Logo",
    "name": "text-savvy-logo",
    "filename": "text-savvy-logo.png",
    "path": "gallery/Logo/Archived/text-savvy-logo.png"
  },
  {
    "id": "Logo_Black_white_versions_glasses-black-and-white_jpg",
    "category": "Logo",
    "name": "glasses-black-and-white",
    "filename": "glasses-black-and-white.jpg",
    "path": "gallery/Logo/Black%26white%20versions/glasses-black-and-white.jpg"
  },
  {
    "id": "Logo_Black_white_versions_icon-black-and-white_png",
    "category": "Logo",
    "name": "icon-black-and-white",
    "filename": "icon-black-and-white.png",
    "path": "gallery/Logo/Black%26white%20versions/icon-black-and-white.png"
  },
  {
    "id": "Logo_Black_white_versions_text-savvy-black-and-white_png",
    "category": "Logo",
    "name": "text-savvy-black-and-white",
    "filename": "text-savvy-black-and-white.png",
    "path": "gallery/Logo/Black%26white%20versions/text-savvy-black-and-white.png"
  },
  {
    "id": "Logo_app-icon-1024x1024_png",
    "category": "Logo",
    "name": "app-icon-1024x1024",
    "filename": "app-icon-1024x1024.png",
    "path": "gallery/Logo/app-icon-1024x1024.png"
  },
  {
    "id": "Logo_app-icon-512x512_png",
    "category": "Logo",
    "name": "app-icon-512x512",
    "filename": "app-icon-512x512.png",
    "path": "gallery/Logo/app-icon-512x512.png"
  },
  {
    "id": "Logo_glasses-1024x1024_png",
    "category": "Logo",
    "name": "glasses-1024x1024",
    "filename": "glasses-1024x1024.png",
    "path": "gallery/Logo/glasses-1024x1024.png"
  },
  {
    "id": "Logo_glasses-512x512_png",
    "category": "Logo",
    "name": "glasses-512x512",
    "filename": "glasses-512x512.png",
    "path": "gallery/Logo/glasses-512x512.png"
  },
  {
    "id": "Logo_glasses-dead-512x512_png",
    "category": "Logo",
    "name": "glasses-dead-512x512",
    "filename": "glasses-dead-512x512.png",
    "path": "gallery/Logo/glasses-dead-512x512.png"
  },
  {
    "id": "Logo_glasses-happy-512x512_png",
    "category": "Logo",
    "name": "glasses-happy-512x512",
    "filename": "glasses-happy-512x512.png",
    "path": "gallery/Logo/glasses-happy-512x512.png"
  },
  {
    "id": "Logo_icon-squircle-1024x1024_png",
    "category": "Logo",
    "name": "icon-squircle-1024x1024",
    "filename": "icon-squircle-1024x1024.png",
    "path": "gallery/Logo/icon-squircle-1024x1024.png"
  },
  {
    "id": "Logo_icon-squircle-512x512_png",
    "category": "Logo",
    "name": "icon-squircle-512x512",
    "filename": "icon-squircle-512x512.png",
    "path": "gallery/Logo/icon-squircle-512x512.png"
  },
  {
    "id": "Logo_splash-screen-786x1704_png",
    "category": "Logo",
    "name": "splash-screen-786x1704",
    "filename": "splash-screen-786x1704.png",
    "path": "gallery/Logo/splash-screen-786x1704.png"
  },
  {
    "id": "Power-Ups_better_bomb_png",
    "category": "Power-Ups",
    "name": "better_bomb",
    "filename": "better_bomb.png",
    "path": "gallery/Power-Ups/better_bomb.png"
  },
  {
    "id": "Power-Ups_better_bomb_no_bg_png",
    "category": "Power-Ups",
    "name": "better_bomb_no_bg",
    "filename": "better_bomb_no_bg.png",
    "path": "gallery/Power-Ups/better_bomb_no_bg.png"
  },
  {
    "id": "Power-Ups_greenie_png",
    "category": "Power-Ups",
    "name": "greenie",
    "filename": "greenie.png",
    "path": "gallery/Power-Ups/greenie.png"
  },
  {
    "id": "Power-Ups_greenie_no_bg_png",
    "category": "Power-Ups",
    "name": "greenie_no_bg",
    "filename": "greenie_no_bg.png",
    "path": "gallery/Power-Ups/greenie_no_bg.png"
  },
  {
    "id": "Power-Ups_letter_bomb_png",
    "category": "Power-Ups",
    "name": "letter_bomb",
    "filename": "letter_bomb.png",
    "path": "gallery/Power-Ups/letter_bomb.png"
  },
  {
    "id": "Power-Ups_letter_bomb_no_bg_png",
    "category": "Power-Ups",
    "name": "letter_bomb_no_bg",
    "filename": "letter_bomb_no_bg.png",
    "path": "gallery/Power-Ups/letter_bomb_no_bg.png"
  },
  {
    "id": "Power-Ups_magniflyer_png",
    "category": "Power-Ups",
    "name": "magniflyer",
    "filename": "magniflyer.png",
    "path": "gallery/Power-Ups/magniflyer.png"
  },
  {
    "id": "Power-Ups_magniflyer_no_bg_png",
    "category": "Power-Ups",
    "name": "magniflyer_no_bg",
    "filename": "magniflyer_no_bg.png",
    "path": "gallery/Power-Ups/magniflyer_no_bg.png"
  },
  {
    "id": "Savvy_Showdown_savvy_showdown_png",
    "category": "Savvy Showdown",
    "name": "savvy_showdown",
    "filename": "savvy_showdown.png",
    "path": "gallery/Savvy%20Showdown/savvy_showdown.png"
  },
  {
    "id": "Savvy_Showdown_super_savvy_showdown_png",
    "category": "Savvy Showdown",
    "name": "super_savvy_showdown",
    "filename": "super_savvy_showdown.png",
    "path": "gallery/Savvy%20Showdown/super_savvy_showdown.png"
  }
]

export const GALLERY_CATEGORIES = Array.from(
  new Set(GALLERY_ITEMS.map((item) => item.category))
)

export function getGalleryItemUrl(item: GalleryItem): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : import.meta.env.BASE_URL + '/'
  return base + item.path
}

export async function fetchGalleryFile(item: GalleryItem): Promise<File> {
  const url = getGalleryItemUrl(item)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load ${item.name} from gallery`)
  const blob = await res.blob()
  const mimeType =
    blob.type ||
    (item.filename.endsWith('.png')
      ? 'image/png'
      : item.filename.endsWith('.jpg') || item.filename.endsWith('.jpeg')
        ? 'image/jpeg'
        : item.filename.endsWith('.svg')
          ? 'image/svg+xml'
          : 'image/png')
  return new File([blob], item.filename, { type: mimeType })
}

export async function downloadGalleryItem(item: GalleryItem): Promise<void> {
  const url = getGalleryItemUrl(item)
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = item.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  } catch {
    const a = document.createElement('a')
    a.href = url
    a.download = item.filename
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
}

export async function downloadGalleryZip(
  items: GalleryItem[],
  zipName: string,
  onProgress?: (progress: { loaded: number; total: number; currentName: string }) => void,
): Promise<void> {
  const files: Record<string, Uint8Array> = {}
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (onProgress) {
      onProgress({ loaded: i + 1, total: items.length, currentName: item.name })
    }
    try {
      const url = getGalleryItemUrl(item)
      const res = await fetch(url)
      if (!res.ok) continue
      const buf = await res.arrayBuffer()
      const zipPath = `${item.category}/${item.filename}`
      files[zipPath] = new Uint8Array(buf)
    } catch (e) {
      console.warn(`Failed to include ${item.name} in zip:`, e)
    }
  }
  const zipData = zipSync(files, { level: 0 })
  const blob = new Blob([new Uint8Array(zipData)], { type: 'application/zip' })
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = zipName.endsWith('.zip') ? zipName : `${zipName}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
}

