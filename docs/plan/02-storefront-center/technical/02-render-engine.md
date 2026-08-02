# 02 — 渲染引擎(高 RPS 個人化 SSR)

> 技術視角:前台的核心「黑科技」——**純 Rust 引擎,連個人化都伺服器端渲染、又高 RPS**。
> **先規劃、不實作**:架構整體設計好,v1 只造靜態路徑,其餘留 seam。

## 定位

差異化**不是發明新原語**,而是把一堆**已驗證的積木**在 Rust 組起來(µs 級、無 Node hydration 稅):Facebook **BigPipe(2010)**、**ESI / Varnish** hole-punching、Rails **Russian-doll** 快取、React 18 streaming、**Astro Server Islands(2024)**——全是同一招。

等同「**Astro Server Islands,但 Rust + MPA + 編譯 render plan**」;伺服器渲染個人化片段、串進靜態外殼,per-request 成本比 JS 框架更低。Shopify / 一線 storefront builder 多半把個人化丟 client(慢一趟、閃一下、SEO 差)——我們正是要贏這塊。

## 鐵律

**個人化 = render 時「查表」,絕不是「運算」。** 推薦 / 排序全在**離線**算好、灌進**熱資料層(Valkey)**,熱路徑只讀。這條做錯,Rust 也救不了。

## 三種區塊渲染類別(每個區塊型別自宣告)

| 類別 | 例子 | 快取鍵 | TTL / 失效 |
|------|------|--------|-----------|
| **STATIC** | banner / 文字 / 圖 / 容器 | `(block_id, publish_version)` | ~永久;發布時清 |
| **DYN_SHARED**(會變、大家一樣) | 熱銷榜 | `(block_id, time_bucket)` | 短 TTL 1–30s + SWR |
| **PER_USER**(每人不同) | 為你推薦 | `(block_id, segment_id)` 優先,user 次之 | 不快取 / session 短 TTL |

## 形狀

### 發布時:把頁面編譯成「op 清單」

```
區塊樹 ─► RENDER-PLAN 編譯器 ─► 扁平 op 清單:
   - 相鄰 STATIC 併成一個 Bytes buffer(Russian-doll digest)
   - 每個 op 標類別 STATIC│DYN_SHARED│PER_USER + 快取鍵模板 + TTL
   - 存成該頁的編譯計畫,用 publish_version 版本化
```

### 請求時:走 op 清單(Rust 熱路徑)

```
axum handler
  ├─ 算 segment_id(便宜,從 cookie/session)
  ├─ 開 streaming body(mpsc → axum Body::from_stream)
  ├─ 走 op 清單:
  │    STATIC     → 吐預算好的 Bytes                (memcpy,近乎免費)
  │    DYN_SHARED → moka.get_with((塊,time_bucket))  (微快取 + single-flight + SWR)
  │    PER_USER   → spawn tokio task:
  │                   熱資料層.get(segment_id)  (Valkey,預算好的推薦清單)
  │                   Maud/Askama 渲染該塊
  │                   out-of-order 串進 body
  ├─ 先 flush 外殼 + STATIC + DYN_SHARED  → TTFB 極小
  └─ PER_USER 片段隨 task 完成串入        → 永不擋 TTFB
```

## 快取(分層,Shopify 式)

- **L1 in-process `moka`**(TinyLFU 準入、TTL/TTI、`get_with` 內建 single-flight)→ **L2 Valkey**(共享,兼線上 feature store)→ origin 運算。
- STATIC:整頁 / 片段快取,`publish_version` bump 即失效。
- DYN_SHARED:微快取 + **stale-while-revalidate**(過期先吐舊、背景更新)+ single-flight。
- PER_USER:熱資料層填,**盡量以 segment 鍵快取**取得高重用。

## 快取鍵粒度(命門)

**per-user 鍵**:命中率趨近 0(基數 = 使用者數)→ 每次全渲染。
**per-segment 鍵**:把人分成幾十~幾百個區隔 → 命中率極高、渲染出的片段還能共享。
→ **能用 segment 就別用 user**;真 per-user 只留給少數高價值版位。這是個人化能高 RPS 的**唯一命門**。

## 串流(out-of-order)

先吐外殼 + 靜態 + 動態共享(全快、全快取)→ 只有 **PER_USER** 片段 out-of-order 串出(慢的那塊不擋首屏)。片段用隱藏 div + 一小段 inline script 歸位;預留固定尺寸避免 CLS。

## Rust 選型(都有現成)

- **骨幹**:`axum` + `hyper` + `tokio` + `tower`(中介:逾時、併發限、load-shed、tracing)。
- **區塊渲染**:**Maud**(編譯期 `html!` 巨集,最快)或 **Askama**(編譯期樣板檔、型別檢查)——**不用** runtime 直譯的 MiniJinja。
- **快取**:**moka**(`get_with` = single-flight、TinyLFU)+ Valkey L2。
- **串流**:`axum::body::Body::from_stream` + `tokio::task`,片段以 owned `Bytes` push 避免重配置。
- **佐證**:業界某自建編譯式模板引擎證明這路對;Shopify 多層快取 + 批次 SQL + 記憶化 = **5×、p75 < 45ms**。

## 分期(合「先規劃不實作」)

| 版 | 做什麼 |
|----|--------|
| **v1(全靜態,還沒商品)** | axum 骨架 + render-plan 編譯器**只處理 STATIC**(整頁併成幾個 Bytes、`publish_version` 當鍵)+ Maud/Askama + moka(發布時清)。**不做**串流 / single-flight / feature-store——全靜態頁本來就 µs 級、好快取。**但現在就埋好 op 清單抽象 + 三類別 enum**。 |
| **v2(有商品)** | 加 DYN_SHARED:moka 微快取 + SWR + single-flight;批次算榜單進 Valkey。 |
| **v3(個人化,差異化)** | 兩層 feature store(離線批次 → Valkey 線上);先 **per-segment** 預算推薦、user 次之;out-of-order 串流上線;segment 鍵微快取。 |
| **v4(edge,真需要才做)** | 把 segment 查詢 + 組裝推到 Fastly Compute(Rust/WASM);origin shield。 |

**紀律**:**現在把架構整體設計好,但只 JIT 造 v1 需要的**。持久的是**抽象**(op 清單、三類別 taxonomy、分層快取介面);串流 / feature-store / edge 等有真實流量才長。**唯一值得現在付的前瞻 = op 清單 + 三類別 enum**,讓 v2/v3 slot-in 不必重寫。

## 來源

- BigPipe — https://engineering.fb.com/2010/06/04/web/bigpipe-pipelining-web-pages-for-high-performance/
- Astro Server Islands — https://astro.build/blog/future-of-astro-server-islands/
- Varnish ESI — https://varnish-cache.org/docs/6.0/users-guide/esi.html
- Rails Russian-doll — https://guides.rubyonrails.org/caching_with_rails.html
- Leptos SSR modes(Rust out-of-order 串流) — https://book.leptos.dev/ssr/23_ssr_modes.html
- Marko streaming — https://markojs.com/docs/explanation/streaming
- Shopify 渲染最佳化 — https://shopify.engineering/simplify-batch-cache-optimized-server-side-storefront-rendering
- moka(get_with single-flight) — https://docs.rs/moka/latest/moka/future/struct.Cache.html
- AWS online feature store(範例為 Redis;我們用 Valkey) — https://aws.amazon.com/blogs/database/build-an-ultra-low-latency-online-feature-store-for-real-time-inferencing-using-amazon-elasticache-for-redis/
