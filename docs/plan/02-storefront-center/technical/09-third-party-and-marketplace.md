# 09 — 第三方擴充與外掛市集

> 技術視角:當有**第三方 script 載入**與**外掛市集**時,前端 JS 執行架構怎麼設計。
> 承接 [08 事件與擴充架構](08-event-and-extension-architecture.md)的「兩平面」,把第三方(不可信)這條展開成**四層信任模型**。
> **先規劃、不實作**;現在只設計接縫。⚠️ 草擬。

## 定位

**核心難題**:在「高 RPS、多租戶」前台跑**不可信的第三方碼**,又不 (a) 拖垮效能 (b) 破壞租戶隔離/安全 (c) 讓一個爛外掛搞掛整頁。

**我們的結構性優勢——SSR-first**:能把絕大多數第三方擴充**趕出瀏覽器**(宣告式 / 伺服器端 / 邊緣),只有真需要 client 互動時才進沙箱。這正是贏 Shopify / 某一線電商平台(它們把第三方都塞 client)的地方。

**鐵律**(承 08):組合/渲染平面**絕不跑任意外掛碼**;要影響 render 只能透過**有界、綁 timeout、fail-open** 的窄接縫。

---

## 四層信任模型

| 層 | 誰 | 跑在哪 | 隔離手法 | 佔比 |
|---|---|---|---|------|
| **T1 宣告式(無碼)** | 多數市集外掛 | 不跑碼 | manifest + 審過的元件集 + schema + 事件訂閱 + server hook | ~80% |
| **T2 伺服/邊緣函式** | 需運算的外掛 | server / edge | **WASM per-request 沙箱**(Wasmtime)+ 硬 timeout/fuel/記憶體 + 能力經 manifest 授權 | |
| **T3 client 沙箱** | 需 client 互動/UI | 瀏覽器 | sandboxed **iframe + Worker + capability 物件**(無原生 DOM);罕見同步高頻 DOM → SES compartment + membrane | |
| **T4 原始 script 逃生門** | 舊行銷標籤 | 盡量**不載** | 優先**伺服器端 fan-out** 取代;不得已才 SRI+CSP+Trusted Types+預算 | 趨近 0 |

**心法**:能宣告就別給碼(T1)→ 要運算推 server/edge(T2)→ 非得 client 互動才沙箱(T3)→ 原始 script 最後手段且優先伺服器化(T4)。

---

## T1 — 宣告式(無碼)

外掛 = 一份 manifest(承 [08](08-event-and-extension-architecture.md) 的區塊 manifest,擴充權限欄位)+ **審過的第一方元件集** + config schema + 事件訂閱 + server hook 宣告。零任意碼在熱路徑。涵蓋大多數市集需求(VTEX / BigCommerce / Shopify app-block 模型)。

---

## T2 — 伺服/邊緣擴充函式(不可信邏輯)

**跑在伺服器/邊緣,不進瀏覽器。**

- **Runtime**:把擴充**編為 WASM component、Wasmtime 每次呼叫全新 instantiate**(per-request 沙箱,啟動 ~µs,爆炸半徑 = 單次呼叫)。與我們 Rust 技術棧天然對齊。隔離模型上 **per-request WASM 沙箱 > 長命 V8 isolate**(後者只是同 process 內 heap 隔離)。v4 推 edge 時,CF Workers 只當「已上能力/預算限制」的載體,**不當唯一隔離層**。
- **語意**:抄 commercetools **API Extensions**——同步 callout、可回傳「改寫 render 的 actions」、**綁死 timeout**。但關鍵改造:熱路徑用 **嚴格 timeout(≤50–100ms)+ fail-open 降級**(逾時就略過該外掛區塊,**不整頁失敗**),而非 commercetools 的 fail-hard 回滾。
- **能力**:綁 CPU fuel / 記憶體上限;**禁 ambient 網路/檔案**,能力須經 manifest 授權。
- **非同步優先**:凡不需即時影響 render → 降級成**非同步 Subscription over `sf-event`**,把同步 T2 表面積壓到最小(commercetools Subscriptions 模型)。

---

## T3 — Client 沙箱(不可信 UI / 互動)

**預設 = sandboxed `iframe` + Web Worker + postMessage capability 物件**(Shopify Web Pixels 模型):不可信碼跑在嚴格 sandbox 的 iframe 內 Worker,**無 `document`/`window`/DOM/cookie**,每租戶/外掛自己的 sandboxed origin = **免費多租戶隔離**;只透過 postMessage 拿 host 給的 curated 能力。

**capability 物件(host 定義,對映 Shopify + 我們的脊椎)**:

| 能力 | 內容 | 對映 |
|------|------|------|
| `events` | 訂閱/發**過濾後的 `sf-event` 投影**(typed、租戶範圍、host 驗 payload) | Shopify `analytics.subscribe` |
| `state` | 不可變 init 快照(區塊 config / locale / tenantId / 非 PII context) | `init` |
| `storage` | async、命名空間化的 cookie/local/session shim(在 host frame 執行) | `browser` |
| `ui` | 宣告式 slot:請求渲染**白名單第一方 Lit 元件** / 受限 DOM patch,**不是 DOM handle** | — |
| `net` | 受 host CSP/allowlist 限制的 `fetch` | — |
| `settings` | 簽章的 per-tenant config | `settings` |

一切以 primitives / 可序列化訊息跨界;記取 Salesforce LWS 教訓——**少讓物件跨界、傳快照不傳 live graph**。

**T3-privileged(罕見:需同步高頻 DOM,如複雜表單/動畫/量測迴圈)**:in-realm **SES / Hardened-JS Compartment** + **membrane**(只暴露 distorted DOM ops,學 LWS「distortion 勝過 wrapping」、LavaMoat 政策模型)。接受 DX 代價(凍結 intrinsics、module shim),**只給審過的外掛**。

**判準**:event-driven 且容忍 async → **iframe/Worker 就夠(絕大多數)**;只有同步高頻 DOM 才升級 in-realm。

**SKIP**:
- **Partytown** —— 是**效能工具、非信任邊界**(proxied script 仍拿到真 DOM/cookie),且對 UI-heavy 不友善。可另留給 T0/T1 純分析腳本卸載,不作 T3 隔離。
- **ShadowRealm** —— Stage 2.7、還不能跨瀏覽器用,且本身只是 namespace 隔離(共 heap),要配 SES + membrane 才安全。**WATCH**,待 Stage 4 + 普及後可能取代 SES-compartment 路徑。

---

## T4 — 原始 script 逃生門

**預設不載廠商 JS**:用**第一方伺服器端 fan-out** 取代——`sf-event` → 第一方收集端 → 伺服器扇出 **GA4 Measurement Protocol / Meta CAPI**(共用 `event_id` / `transaction_id` 去重)。好處:效能、抗廣告攔截、隱私(轉發前 redact PII)、第一方 cookie 抗 ITP。**這條消滅大多數 T4 需求,也是我們的差異化。**

真的必須載外部 script 時:**只允許釘死 SRI hash 的版本化 bundle** + 嚴格 **CSP**(`script-src` hash/nonce、`connect-src` 白名單)+ **Trusted Types** + 每 script 效能預算 + kill switch。**無 hash / 無 manifest 權限 → 不載。**

---

## 配送與完整性

- **載入原語**:原生 `import()` + **Import Maps**(key/version 釘住/別名)。比 Module Federation 輕、無框架綁定。
- **完整性**:**import-map `integrity` 區段**把 module URL 映到 hash(裸 `import()` 歷來不支援 SRI;import-map integrity 為新解,主流瀏覽器 2025-09 起支援)。**所有進瀏覽器的外掛資產一律釘 SRI hash,無 hash 不載。**
- **CDN**:內容定址、immutable 版本化 URL、`Cache-Control: immutable`。
- **SKIP**:**Module Federation** 作為信任邊界——它解耦部署、不解決不可信,且複雜度/版本偏移風險高。

---

## 市集治理(最小可行)

| 關卡 | 機制 | verdict |
|------|------|---------|
| **Manifest 權限** | 宣告 `permissions` / `host_permissions` / `connect` 目標,**declared-vs-granted**、預設關(WebExtensions 模型) | **ADOPT** |
| **審核 gate** | 上架前人工審 + **效能門檻**(抄 Built-for-Shopify:LCP/INP 預算)+ 強制事件約定 | **ADAPT**(先簡,別抄整套繁瑣) |
| **完整性** | 所有進瀏覽器資產釘 **SRI hash**(import-map integrity)、immutable CDN | **ADOPT** |
| **runtime 圈禁** | 嚴格 **CSP** + **Trusted Types**(DOM sink 只收 TrustedHTML,壓死 DOM-XSS;與 Lit WC 相容) | **ADOPT(打底)** |
| **營運** | 每外掛效能預算 → 超標**熔斷**;**分批灰度(canary→全量)+ 一鍵 kill switch** | **ADOPT(必備)** |

---

## 與某一線電商平台 / Shopify 的差異(我們的超車)

- 他們把第三方追蹤/邏輯**大量塞 client**(載一堆廠商 JS、client fan-out pixel);我們 **SSR-first**,把 T1 宣告化、T2 推 server/edge WASM、T4 用**伺服器端 fan-out** 取代載 JS——**熱路徑保持乾淨、Node-free、抗擋阻**。
- 隔離上,我們有 **Rust→WASM per-request 沙箱** 這條他們沒有的乾淨路;client 端才用 iframe/Worker capability(與 Shopify Web Pixels 同級)。
- 淨效果:**市集的價值拿到,不可信碼的重量與風險擋在瀏覽器與熱路徑之外。**

---

## 現在做 vs 延後

**現在(設計接縫,不建 kernel)**:
- 事件脊椎的 capability 投影邊界先在設計上留好(T3 的 `events` = 過濾後 `sf-event`)。
- 區塊 manifest 補 `permissions`(declared-vs-granted)欄位——今天 granted = 全部第一方,先留 split。
- SSR 引擎預設**嚴格 CSP + Trusted Types**;資產走 SRI。

**延後(等真有第三方上架)**:
- T2 的 WASM extension runtime(Wasmtime instantiate + fuel/timeout)。
- T3 的 iframe+Worker sandbox host + capability 物件實作;T3-privileged 的 SES compartment。
- 市集審核流程、效能預算熔斷、灰度/kill switch、import-map integrity 配送。

---

## 分期(對照 [02 渲染引擎](02-render-engine.md) / [08](08-event-and-extension-architecture.md))

- **v1–v2**:只有第一方 T1;CSP + Trusted Types + SRI 打底先上。
- **v3**:伺服器端 fan-out(T4 正解)+ 第一方 collector;開始收 T2 的 server extension(先非 WASM 的受控 server hook + timeout)。
- **v4**:edge(CF/Fastly)+ **WASM per-request T2 沙箱**;開放市集 → T3 iframe/Worker sandbox + manifest 權限 + 審核 gate + 灰度/kill switch。

---

## 附錄 A:關鍵數字與取捨(研究佐證)

**T2 runtime — 為何 per-request WASM > 長命 V8 isolate**
- **Fastly Compute**:Wasmtime,**每 request 全新 WASM 沙箱**、instantiate ~35µs、linear-memory SFI 邊界;**無跨呼叫狀態殘留**、**wall-clock** 硬 timeout(超時→503)——直接對映 SSR 延遲預算。
- **CF Workers**:V8 isolate,cold start <5ms、記憶體 **128MB** 硬上限;但邊界只是**同 process 內 heap 隔離(軟)**,CF 靠 seccomp/namespaces/cordon/Spectre 緩解疊起來補——那是 CF 營運的,自架 V8 得自己重造整套。isolate **長命、跨請求共用** → 需自己設計無狀態;timeout 計 **CPU time(I/O 不算)** → 要 SSR wall-clock 預算得自己再守一層。
- 結論:T2 首選 **Rust→WASM component + Wasmtime per-request**;edge 落地時 Fastly 的 per-request 模型比 CF 契合。

**T2 語意 — commercetools API Extensions 可抄細節**
- timeout:連線 1s、預設 2s、可設到 10s;**逾時/500/不可達 = 整個操作失敗不落地**(fail-hard)。
- 分錯誤碼:無回應(504 `ExtensionNoResponse`)/ 回應壞(502 `ExtensionBadResponse`)/ actions 套用失敗(502);**API 內不重試**;回傳**上限 100 個 update actions**(受驗證)或 typed 拒絕(400);**每專案 ≤25 extension、鏈深 ≤3**。
- 我們改造:熱路徑 timeout 更嚴(≤50–100ms)+ **fail-open 降級**(略過該區塊、不整頁失敗),保留「分錯誤碼 + 不重試 + 有界回傳 + hook 數/深度上限」。

**配送 / 完整性**
- 載入:`import()` + Import Maps(`scopes` 讓每外掛各自版本,MF 的反面);**Module Federation 無信任邊界 → SKIP**。
- SRI:**import-map `integrity` 區段**是唯一能替 dynamic import 帶 SRI 的路;**Chrome 127 / Safari 18 已支援,Firefox 待定**(es-module-shims 可 polyfill)。**SRI 只保證「位元組是我批准的」,不等於「碼安全」**——隔離仍要另做。

**市集治理 — 可抄的硬規則**
- 審核:自動 gate + 人工;**強制 GDPR 回呼**(`customers/data_request`、`customers/redact`、`shop/redact`),HMAC 不符必回 **401**、30 天內完成(Shopify 最常見退件點)。
- 效能門檻:「裝前後 storefront Lighthouse 掉分 **≤10**」可直接抄;BFS 進階(p75)LCP ≤2.5s / CLS ≤0.1 / INP ≤200ms 需真流量,延到認證層。
- 權限:WebExtensions **declared-vs-granted**(安裝時 `permissions`/`host_permissions` + 執行期 `optional_*` 需 user gesture);host `getAll/onAdded/onRemoved` 供租戶查看/撤銷;最小權限(activeTab 式「只作用於剛點的版位」)。
- CSP:嚴格 nonce baseline;**`connect-src` = 由 manifest 宣告的外掛出口白名單**(外掛實體上連不到未宣告 host → 擋外洩)。
- Trusted Types:`require-trusted-types-for 'script'`,DOM sink 只收 TrustedHTML;**先 Report-Only 再 enforce**(Baseline 2026-02)。
- 營運:**kill switch 上線必備**(秒級遠端停用、免部署)+ 灰度(canary%);效能/錯誤預算超標 → **自動觸發 kill**(LaunchDarkly Flag Triggers 模式)。

**伺服器端 fan-out(T4 正解)— 現實面**
- 去重:GA4 MP 需帶瀏覽器同一 `client_id`/`session_id`(否則歸因掉);Meta CAPI 靠 **`event_id`+`event_name`、48h 內去重**、衝突時先到者留。
- 但它是**要自己跑 + 付費的基建**(sGTM ~$120/mo App Engine 最低 / Cloud Run ~$20–135/mo);**仍需 client 端擷取**(clicks/scroll/client_id)+ 同意管理;**抗廣告攔截是「韌性」非「規避」**(不可繞 opt-out)。
- **可產品化角度**:平台提供**託管的第一方 server-side tagging**,商家不必各自架 GCP——這是賣點。

## 來源

**邊緣/isolate/WASM** — CF Workers CPU https://blog.cloudflare.com/unpacking-cloudflare-workers-cpu-performance-benchmarks/ · Workers limits https://developers.cloudflare.com/workers/platform/limits/ · V8 isolate https://fordelstudios.com/research/how-v8-isolates-actually-work-under-the-hood · Fastly Compute https://docs.fastly.com/products/compute · Wasmtime https://bytecodealliance.org/articles/wasmtime-1-0-fast-safe-and-production-ready

**擴充語意** — commercetools API Extensions https://docs.commercetools.com/api/projects/api-extensions · timeout 提升 https://docs.commercetools.com/api/releases/2026-03-03-increased-maximum-timeout-limit-for-api-extensions

**伺服器端 tagging** — GA4 MP https://developers.google.com/analytics/devguides/collection/protocol/ga4 · Meta CAPI https://developers.facebook.com/docs/marketing-api/conversions-api/ · sGTM+CAPI https://www.simoahava.com/analytics/facebook-conversions-api-gtm-server-side-tagging/

**client 沙箱** — Partytown https://partytown.builder.io/ · SES/Hardened JS https://hardenedjs.org/ · ShadowRealm https://github.com/tc39/proposal-shadowrealm/blob/main/explainer.md · Salesforce LWS https://developer.salesforce.com/docs/platform/lightning-components-security/guide/get-started-compare-lws-locker.html · Shopify Web Pixels https://shopify.dev/docs/api/web-pixels-api

**配送/完整性/治理** — import-map integrity https://jspm.org/js-integrity-with-import-maps · SRI https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity · WebExtensions permissions https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/permissions · Trusted Types https://web.dev/articles/trusted-types · Built for Shopify https://shopify.dev/docs/apps/launch/built-for-shopify/requirements

> 某產線級外掛 SDK / EventBridge 為內部原碼,無公開文件;本文對照其結構歸納。
