# 0005 — admin review:logger、路由與模組命名、視覺一致性

> 日期:2026-08-05。admin 逐檔 review 的產出。storefront-center(Rust)未動,資料源仍是 `api/mock.ts`。

## 狀態

- **logger 補上**([`shared/logger.ts`](../../projects/admin/src/shared/logger.ts)):分級 + 命名空間,dev 全開 / production 只留 warn 以上,`VITE_LOG_LEVEL` 可覆寫。`http.ts` 的失敗一律記一筆再往外丟(不吞錯)。
- **過早的認證拔掉**:`http.ts` 不再塞 `localStorage` 的 token —— v1 沒有登入系統。原本註解承諾的「統一錯誤」反而從沒實作,現在補上了。
- **路由改名** `_shell` → `_layout`(TanStack 對 pathless layout route 的慣用名),13 個 route id 一併改。
- **字級收斂**:antd token `fontSize` 16 → 14(預設值);`index.css` 補 `body { font-size: 14px }`。
- **表格欄位一致性**(三個列表頁):主動作補圖示、名稱欄去粗體、狀態欄只顯示狀態、生效條件統一走 Tag。
- **共用件分層**:`page-block-editor/` 拆成 `components/page-template/`(7 檔,被 route 使用)+ `components/block-editor/`(9 檔,編輯器實作)。`template-ui.tsx` 拆成 `StatusTag` + `TargetingTags`。

跨組依賴只有兩條,方向單一(page-template → block-editor):`PageFormShell → ContentField`、`ChromePicker → BlockView`。

## 決策

- **狀態欄只顯示狀態,動作進「更多」**。原本狀態欄混了 `Switch`,而常態版的 Switch 是 `disabled` → **同一個生效狀態出現兩種深淺**。暫停 / 恢復移進「更多」下拉,跟「發布」同層級;常態版那項 disabled(業務規則:常態版不可暫停)。
- **同一欄不混呈現形式**。生效條件原本「有條件是 Tag、沒條件是裸文字」,Tag 有外框內距、純文字沒有 → 列高與基線會跳。改成沒條件也用淡色 Tag。
- **不抽 `PageTable`**。三個列表頁確實高度重複(5 個 mutation、moreItems、ProTable 設定),但明確決定不做這層抽象。
- **模組命名 `page-template`**。`page` 太抽象(跟 glossary 的「頁面」撞名,而且它同時指網址 / 頁面類型 / 可編輯單位);`template` 太通用。`page-template` 對上程式的 `PageTemplate` 與 DB 的 `templates`。
- **「共用件」的判準 = 被 route 使用**。編輯器的私有實作(9 檔)route 完全不碰,不與共用件同列。
- **logger 不引第三方**。pino / winston 是 Node 取向,瀏覽器端只會多打包一包;要的是「production 不噴 debug、每行看得出模組」,console 包一層就夠。之後要接遠端收集只在 `emit` 多一個出口。
- **query key 先做工廠,不上 orval**(尚未實作,見下)。orval 的前提不存在:Rust 端沒有 utoipa / aide,不產生 OpenAPI spec。而且它會生成吃 `slot` 參數的形狀,正好跟 admin「三個版位各自獨立門面、不吃 slot 參數」的設計相反,也會沖掉 `api/types.ts` 手寫的中文領域註解。

## 註(踩到的坑)

- **改路由資料夾要先讓 vite 插件跑一次**。`pnpm build` 是 `tsc -b && vite build`,但 `routeTree.gen.ts` 是插件產生的 —— tsc 跑在前面,會拿舊的路由樹報 13 個型別錯。先跑一次 `vite build` 再跑完整 build。
- **antd 的 `cssVar` 幫不上忙**。試過用它讓 `index.css` 與 antd token 同源,但變數掛在 antd 自己產生的 scope class(`.css-var-*`)上,`body` 讀不到 → 已撤回。字級只能兩處各寫一份並互相註明。品牌色(`--color-brand` / `colorPrimary`)是同樣的手抄兩份,未處理。

## 下一輪要做

1. **M2 code review**(storefront-center)—— [0002](0002-storefront-backend-m2.md) 就列了,連續三輪都被前端工作插隊,仍未做。
2. **query key 工廠**(`api/keys.ts`):現在 `['home','list']`、`['home','entity',id]`、`['home','ctx-header',x]` 這類字面量散在 11 個檔,`invalidateQueries({queryKey:['home']})` 靠約定生效,打錯字不會有人告訴你。
3. admin `mock.ts` → 打真後端(前後端打通)。
4. 接 sqlx adapter,把 migration 交給它管(PG 已就位:`make up`)。
5. M3 Rust 端渲染 + M4 渲染引擎。

## 還需要決策

| # | 事項 | 為什麼卡著 |
|---|------|-----------|
| 1 | **glossary + 04-page-model 對齊 Model B** | 商業視角整份停在 Model B 之前:「區段(Section)」沒有這個實體(container / stack 區塊在做)、「區段組設一次套全站」已變成 slot 模板 + 單頁 chrome 覆寫、區塊型別寫 banner / 文字清單(實際是 9 個組合原語)、`templates` 表沒有 slug 也沒有 SEO 欄位、`BlockSize` 沒有分裝置。**是 spec,需 PO 核可** |
| 2 | **Page 這個詞怎麼拆** | 提議:版位(Slot)/ 模板(Template)/ 外框(Chrome)三分,`頁面` 降級為「訪客看到的那一頁 = 版位解析出的模板 + 外框」,不再是實體 |
| 3 | orval 的時機 | 取決於 Rust 端要不要加 utoipa 產 OpenAPI —— 那是後端決定,建議等 M2 review 完、API 定案再評估 |
| 4 | `page-template/` 要不要再往下分 | 例如 `list/`(AuditDrawer)、`form/`(FormShell、publishConfirm、ChromePicker、TargetingFields)。7 檔目前還在一眼可讀範圍 |
| 5 | 剩下的粗體 | [`BlockTreeEditor`](../../projects/admin/src/components/block-editor/BlockTreeEditor.tsx) 頂列標題用 `<strong>`(語意錯,該用 Title);`TargetingFields` / `ChromePicker` 的 `font-medium` 三處 |
| 6 | 18 個 oxlint warning | 全是 `react/only-export-components`,集中在 `routes/`,是 TanStack 檔案式路由的正常型態。要讓 lint 乾淨可在 overrides 針對 `routes/**` 關掉 |
| 7 | `BlockView` 的 `apply` 依賴 | 刻意省略以保持 callback ref 穩定(意圖寫在註解),oxlint 不報但 eslint 會報 —— 是「oxlint 標準下乾淨」,不是沒有依賴問題 |
| 8 | blocks 的兩項(0004 留下) | `icon` 的 `<a>` 只有 SVG、**沒有可及名稱**;`container` / `stack` / `icon` 的 `box-sizing` 多餘 |
| 9 | remote 名稱 | `origin` 還是 `rust_point`,點數中心時代的舊名 |

## 未處理的既有缺口

Rust 側 **0 個測試**、多租戶仍是 stub、`api/mock.ts`(401 行)仍是 admin 的資料源。
