# 08 — 事件與擴充架構

> 技術視角:區塊如何**發事件 / 被追蹤 / 被擴充 / 被組合**。
> 對照某一線電商平台的外掛平台、Shopify 與多家電商/CMS 的外掛與觀察者模式,定我們的取捨。
> **先規劃、不實作**;事件脊椎的最小地基已在 `projects/blocks`。⚠️ 草擬。

## 定位

參考業界後歸納出一句地基:**擴充要分成兩個平面,絕不混。**

- **組合 / 渲染平面**(同步、在 SSR 熱路徑):頁面由**有型別契約 + config schema 的區塊**組成,靠 manifest 註冊、租戶覆蓋順序明確;任何 hook 只能是**有界的純轉換**,**絕不在 SSR 跑任意外掛碼**。
- **事件平面**(非同步、離開熱路徑):`sf-event` 觀察者匯流排——動作(命令)與追蹤(觀察)走**同一條脊椎**,由 router 分 `execute`(行為)與 `sinks`(追蹤 fan-out)。

這條分界是所有平台痛史的共同教訓(WordPress 動態 dispatch、Magento `around` proxy、BigCommerce Scripts API 任意注入):**「能在渲染時跑任意外掛碼」這一個選擇,就毀掉 RPS 與多租戶隔離。** 我們從一開始就不給這個能力。

---

## 事件平面

### 傳輸:`sf-event`(composed CustomEvent)

Web 原生、零依賴、框架無關,`composed: true` 讓事件穿出 Shadow DOM、`bubbles: true` 冒泡到宿主根——比 Dawn 的「離 DOM 的 module-level bus」多了**免費的樹範圍化 + 自動 teardown**。這就是我們已有的脊椎。

### 語彙:GA4 目錄 + 字串上線 + 生成型別

- 事件名**仿 GA4**,一處定義成常數目錄 `SF_EVENTS`(`page_view` / `view_promotion` / `select_promotion` / `view_item_list` / `add_to_cart` / `begin_checkout` / `block_hover` …)——學 Dawn `PUB_SUB_EVENTS` 與 Shopify Web Pixels 標準目錄,**杜絕字串漂移**。
- **線上用字串**(彈性、租戶可授權、與 GA4 對齊);**從 manifest 生 TS union** 給編輯器打字安全——「人打字的地方型別安全,匯流排上保持彈性」。

### Router:`execute` + `sinks`(fan-out)

```
sf-event ──► installEventRouter(target, { execute, sinks })
               ├─ execute?(event, ctx)   // 命令型 → 行為(導頁 / 彈 mini-cart / 開登入)
               └─ sinks[]                // 全部事件 → 追蹤目的地(各自批次上報、不擋)
```

`execute` 是命令面向(只動命令型事件),`sinks` 是 N 個可插拔追蹤目的地。同一手勢 → 一個事件 → 同時 `execute` + 送所有 `sinks`。這比「寫死 execute/track 兩面向」更能長大(某一線電商平台的 tracking 只是眾多 target service 之一)。

### 動作解耦(命令)

區塊**只宣告意圖**、不寫死 `href`。商家在編輯器配 `BlockAction { kind, params }`(kind 仿 GA4);點擊時區塊 `fire(kind, params)`,由 `execute` 解讀。因為「加入購物車」是彈 mini-cart 非導頁,`href` 表達不了。與 Builder.io / Plasmic 的共同最佳實踐一致:**「什麼觸發」與「做什麼」分離,能力由 context/ref 注入、不由 markup。**

### Context 注入(A/B 的關鍵)

一個凍結的 `SfContext`(`tenantId` / `locale` / `pageType` / **`templateVariant`** / session),**從 SSR 內嵌 JSON(`<script type="application/json">`)灌一次**(權威、Node-free);router 併進每顆事件的信封。

**`templateVariant` 讓多模板 A/B 歸因天生成立**——每個曝光 / 點擊 / 轉換都知道自己屬於哪個首頁版本。對應某一線電商平台注入 `viewType` / `contentSource`,我們多注入 variant。

### Buffer + readiness latch

router / 匯流排帶一個小環形 buffer(drop-oldest,上限 ~64)+ `ready` 閂:sink 掛上前發的事件先排隊、`ready` 後重放;晚到的 subscriber 可要 latch 主題(variant / context)的 last-value。這是 RxJS `ReplaySubject(1)` 的概念,**手刻 ~50 行,不引入 RxJS / mitt**。解決「tracking 還沒好就發 page_view」(對應某一線電商平台的 `RESOURCE_IS_READY` / `ALL_RESOURCE_READY` 握手)。

### 宣告式 event bridge(seed,之後長)

多租戶需要「不改碼就能重接事件」。仿某產線級外掛 SDK 的 EventBridge,用 config 而非 code:

```jsonc
{ "on":  "variant_changed",                 // 來源事件
  "emit": "select_item",                     // 目標事件(router 意圖)
  "map":  { "item_id": "$.detail.sku", "price": "$.detail.price" },
  "inject": ["tenantId", "templateVariant"]  // context 注入
}
```

現在先留 seed(events.ts 的 router + context),bridge 的 config 解讀之後補。

### 追蹤:第一方語彙、伺服器端 fan-out

- **自己擁有語彙**(餵我們的個人化引擎 + A/B),但 **sink 可插拔**:第一個 sink = **自家 collector**;GA4 / Meta 之後掛。
- **與某一線電商平台的關鍵差異**:他們全 **client-side** fan-out 一堆 pixel;我們 **SSR-first**,事件送**自家 collector(server / edge)**,再用**伺服器端** fan-out(GA4 Measurement Protocol、Meta CAPI)——**更快、抗廣告攔截、更準**,直接餵個人化 + A/B。
- **第三方 sink 要隔離**:第一方 WC 直接給 DOM;將來若收第三方追蹤碼,給它 curated capability 物件 + worker/iframe(學 Shopify Web Pixels 嚴格沙箱),**不是改事件表面**。現在不做,但事件命名先讓這條邊界能無痛出現。

---

## 組合 / 擴充平面

### 區塊 manifest = 單一事實來源

每個區塊宣告一份 manifest(metadata,編輯器 build 期驗證;Rust 驗證器與 TS SDK 共用一份語彙、不漂移):

```jsonc
{ "block": {
    "key": "sf-product-card",
    "version": "1.4.0",
    "inputs":      [ { "name": "sku", "type": "string", "required": true } ],  // schema 一源
    "scopes":      { "enabledOn": ["home", "product"] },                        // 頁面/模板範圍
    "emits":       ["add_to_cart", "select_item"],                             // GA4 對齊
    "subscribes":  ["variant_changed", "template_ab_variant"],
    "assets":      { "js": "sf-product-card.js", "css": "sf-product-card.css" },
    "permissions": { "declared": ["read:cart"], "granted": ["read:cart"] } } }
```

- **schema 一源**:同一份 `inputs` 餵①編輯器自動生表單 ②SSR 渲染綁定 ③config 驗證(Shopify Theme App Extensions、BigCommerce widget 的黃金骨架)。
- **`emits` / `subscribes`** = 某產線級外掛 SDK 的 `commandChannelEvents` / `externalSubscriptions`。
- **`declared` vs `granted` permissions** 分兩份、永遠檢查 granted(WebExtension 模式);今天 granted = 「全部第一方」也先留這個 split,替第三方區塊鋪路。
- **lazy per-block assets**:CSS/JS 只在區塊被放上頁面時才載——直接服務高 RPS,只送該頁 WC bundle。

### 命名區域 / mount targets

頁面暴露命名 mount 點,區塊宣告式綁定(Shopify `@app` slot、Checkout UI `targets`)。把「能放哪」與區塊內部解耦,並支援 `enabledOn` 這種範圍規則。

### 租戶覆蓋順序(明確、確定)

多租戶客製 + 升級安全靠**分層覆蓋**(SFCC cartridge path、VTEX 原生區塊覆蓋):租戶層可 shadow 基底區塊/模板。但**排序與「誰贏 / 誰回傳值」必須明確宣告、可決定**——別學 SFCC 的「最後一個贏、順序未定」。

### hook 只能是有界純轉換

需要在渲染時介入時,只開一種:**filter / transform**(吃一個值、回傳改過的值,ordered pipeline,WordPress filters 的概念),而且**有 timeout 預算**。**不做 interceptor**(Magento `around` 包任意方法——強大但效能與維護陷阱,高 RPS Rust 路徑不能有)。

---

## Prior-art 對照(借什麼 / verdict)

| 來源 | 借的概念 | Verdict |
|------|----------|---------|
| **某產線級外掛 SDK**(EventBridge / tracking service / manifest) | 宣告式事件映射 + context 注入 + manifest 訂閱 + 三層解耦(producer→bridge→sink) | **ADOPT 骨架**;丟宿主債 / App(jsi)債 / client-pixel 重量 |
| **Shopify** Theme App Ext / Web Pixels / Dawn PubSub / Checkout targets | 區塊 manifest(schema+scope+lazy asset)、GA4 事件目錄、命名 target、(未來)嚴格沙箱 | ADAPT;跳過 Liquid / 商家注入碼 |
| **WooCommerce** actions/filters | 事件 vs 「吃值回傳」轉換 的二分 | ADAPT 概念,棄全域字串動態 dispatch |
| **Magento 2** plugins / observers | `events.xml` 宣告式 name→handler(observer);`around` interceptor | ADAPT observer；**SKIP** interceptor |
| **VTEX IO** | 區塊 = 綁 interface 契約、manifest 組合、覆蓋順序 | ADOPT 組合模型;棄每租戶 Node runtime |
| **SFCC** cartridge path / hooks | 分層覆蓋(升級安全) | ADAPT;但排序/回傳要確定 |
| **BigCommerce** Page Builder widget | **widget = template + JSON schema**(驅動編輯器 UI + 驗證) | **ADOPT**(最直接可移植);SKIP Scripts API 任意注入 |
| **commercetools** API Extensions vs Subscriptions | 同步阻塞(帶 timeout)vs 非同步反應 的明確二分 | ADOPT 心智模型 |
| **single-spa / Module Federation** | 「按 key+version lazy load」 | **SKIP now**(它們假設瀏覽器是整合者;我們是 Rust);要時用純 dynamic `import()` |
| **EventTarget / CustomEvent(composed)** | 我們的傳輸 | **ADOPT**(已用) |
| **RxJS / mitt** | buffer / latch / combineLatest 概念 | 概念 ADAPT,**不引入依賴**(手刻 ~50 行) |
| **Builder.io / Plasmic / Webflow** | 元件註冊(inputs schema)+ 觸發與行為分離、能力由 context/ref 注入 | ADOPT 概念(我們 router 已符合) |

---

## 現在做 vs 延後

**現在(輕、無 kernel)**:

1. 事件脊椎已具:`sf-event` + `installEventRouter({ execute, sinks })` + `SfContext`(含 `templateVariant`)+ `SF_EVENTS` 目錄 + `consoleSink`。
2. 補:buffer + readiness latch(~50 行)、context 從 SSR JSON 灌。
3. **薄區塊 manifest**(metadata):key / version / inputs schema / scopes / emits / subscribes / assets / permissions(declared vs granted)。
4. **宣告式 event bridge** 的 config 解讀(架在現有脊椎上)。

**延後(等真有第二方 / 第二框架 / 第三方碼)**:

- 正式 **plugin kernel**(runtime 安裝、沙箱隔離、permission broker、capability token)——manifest schema 先留位。
- **Module Federation / single-spa** runtime 組合。
- **RxJS / mitt** 當依賴。
- 第三方追蹤 sink 的沙箱隔離(邊界先設計)。
- interceptor 式擴充(不做)。

**淨結果**:拿到某產線級外掛 SDK / EventBridge **90% 的價值、~1% 的 runtime 成本**,且 Rust SSR 熱路徑保持 Node-free。

---

## 分期(對照 [02 渲染引擎](02-render-engine.md))

- **v1**:事件脊椎(已具)+ 薄 manifest + `consoleSink`;編輯器裝 inert router(execute 提示、track console)。
- **v2**:自家 collector sink;宣告式 bridge config;buffer/latch 上線。
- **v3**:伺服器端 fan-out(GA4 MP / Meta CAPI);行為數據 → 個人化 pipeline;A/B 以 `templateVariant` 歸因成報表。
- **v4**:第三方 sink 沙箱;(若需)plugin kernel。

---

## 來源

**Shopify** — Theme App Extensions https://shopify.dev/docs/apps/build/online-store/theme-app-extensions · App blocks https://shopify.dev/docs/storefronts/themes/architecture/blocks/app-blocks · Web Pixels https://shopify.dev/docs/api/web-pixels-api · 標準事件 https://shopify.dev/docs/api/web-pixels-api/standard-events · Dawn pubsub https://github.com/Shopify/dawn/blob/main/assets/pubsub.js · Checkout UI targets https://shopify.dev/docs/api/checkout-ui-extensions/latest/extension-targets-overview

**其他電商/CMS** — WooCommerce hooks https://learn.rtcamp.com/courses/basic-plugin-development/l/getting-started/t/hooks-actions-and-filters/ · Magento plugins/observers https://m.academy/articles/plugins-interceptors-event-observers-magento-2/ · VTEX IO builders https://developers.vtex.com/docs/guides/vtex-io-documentation-store-builder · VTEX 覆蓋 https://developers.vtex.com/docs/guides/vtex-io-documentation-overriding-native-app-blocks · SFCC hooks https://developer.salesforce.com/docs/commerce/sfra/guide/b2c-sfra-hooks.html · BigCommerce widget schema https://developer.bigcommerce.com/docs/storefront/widgets/widget-builder · commercetools API Extensions https://docs.commercetools.com/api/projects/api-extensions · Subscriptions https://docs.commercetools.com/api/projects/subscriptions

**Micro-frontend / 觀察者** — Module Federation https://rspack.rs/guide/features/module-federation · CustomEvent composed https://developer.mozilla.org/en-US/docs/Web/API/Event/composed · Shadow DOM 事件 https://javascript.info/shadow-dom-events · Builder.io registerComponent https://www.builder.io/c/docs/register-components-options · Plasmic code components https://docs.plasmic.app/learn/code-components-ref/

> 某產線級外掛 SDK / EventBridge 為內部原碼(EventBridge plugin、tracking service、plugin manifest 三檔),無公開文件;本文對照其結構歸納。
