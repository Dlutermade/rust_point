# 0004 — blocks review:目錄分層、前端工具鏈統一

> 日期:2026-08-05。blocks 逐檔 review 的產出。storefront-center(Rust)未動。

## 狀態

- **`src` 按角色分層**:根目錄只剩 `index.ts`。`contract/`(block-type · action · spacing)、`core/`(block-element · register-element · registry)、`events/`(event · context · router)、`icons/`(paths · index)、`blocks/{layout,content,separator}`、`styles/`、`dev/`。
- **reset 收斂**:搬到 `styles/reset.ts`;拿掉 `ul,ol { list-style: none }` 與 `a { color: inherit; text-decoration: none }`。
- **註解砍複述型 8 處**(contract 的純翻譯、container 重述 `showIf`、button/icon 重複 `actionHref` 的理由…),決策型全留。
- **工具鏈統一**:一份 root `.oxlintrc.json` + `.oxfmtrc.json` 管 admin 與 blocks;blocks 這才第一次被 lint / format 到。移除 6 處死的 `eslint-disable`。
- **清掉樣板死檔**:`src/assets/`(hero.png · lit.svg · vite.svg)+ `public/`(favicon.svg · icons.svg),零引用,而 `files: ["dist","src"]` 原本會把它們發佈出去。
- **`.vscode` 修好**:補 `[typescriptreact]` / `[javascriptreact]`;`rust-analyzer.linkedProjects` 從已刪除的 point-center 改指 storefront-center。

## 決策

- **資料夾都 ≥2 檔**,不為單檔開一層。`contract.ts`(95 行 / 3 概念)、`events.ts`(103 行 / 3 概念)、`icons.ts` 因此拆開,而不是原檔搬進同名資料夾。
- **`blocks/separator/` 而非 `spacing/`**:`spacer` 與 `divider` 的共同角色是分隔(一個用留白、一個用線),而 `spacing` 這個名字已經被 `contract/spacing.ts` 的 X/Y 間距型別佔用。
- **`dev/` 排除於 dts 輸出**(`vite.config.ts` 的 `exclude`),讓目錄界線等於公開 API 界線,不只是目錄好看。
- **reset 只中和瀏覽器預設,不做設計主張**:連結底線 / 清單樣式歸各區塊決定 —— 全域清掉會連帶清掉可及性(`list-style: none` 會讓 VoiceOver 丟掉清單語意)。
- **註解判準**:刪掉「刪了讀者不會少知道一件事」的複述型,留決策型。
- **前端工具鏈不碰 Rust**:指令寫死 `projects/admin/src projects/blocks/src`;Rust 走 `make lint` / `fmt`(cargo),前端走 `make web-lint` / `web-fmt`,兩套不共用動詞。

## 註(踩到的坑)

- **oxfmt 會格式化 `css` / `html` 模板字串**。`blocks/content/text.ts` 的內文是 `white-space: pre-wrap`,模板被折行後縮排空白原樣渲染,高度從 27px 變 82px。該模板必須維持在 printWidth 內。
- **`.tsx` 的 language id 是 `typescriptreact`**。`.vscode` 只設 `[typescript]` 時,admin(幾乎全 `.tsx`)存檔即落回 VS Code 預設格式器,改成雙引號 + 分號,和 oxfmt 設定對打。`extensions.json` 也要有 —— 擴充套件沒裝時 `formatOnSave` 靜默失效。
- **6 處 `eslint-disable` 全是死指令**(本 repo 沒有 eslint,且抑制的規則都沒啟用)。但 oxlint 的 `exhaustive-deps` 覆蓋不及 eslint —— `BlockView` 那個刻意省略的依賴,eslint 會報、oxlint 不會。是「oxlint 標準下乾淨」,不是「沒有依賴問題」。
- CSS 文字裝飾**不會傳播到脫離文檔流的子元素**,所以 `icon` 的角標(`position: absolute`)不受連結底線影響 —— 一度誤判成 regression 並加了多餘規則,已撤。

## 未處理(review 發現,待決定)

- `icon` 的 `<a>` 內只有 SVG,**沒有可及名稱**,螢幕閱讀器讀不出這是什麼連結(可從 `ICON_LABELS` 取 `aria-label`)。
- `container` / `stack` / `icon` 裡的 `box-sizing: border-box` 是多餘的,reset 的 `*` 已涵蓋。

## 下一步

- **admin review**(進行中)。
- 之後仍未做:**M2 code review**(storefront-center,0002 就列了)、admin `mock.ts` → 打真後端、sqlx adapter、M3/M4。
- Rust 側仍是 **0 個測試**、多租戶 stub。
