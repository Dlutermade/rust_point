# 03 — 使用案例(時序圖)

> 技術視角:核心流程以**時序圖**表達(use case = 時序圖),由外而內。
> 先規劃、不實作。⚠️ 草擬,待 PO 核對。

## 流程一:訪客載入一頁(高 RPS 熱路徑)

```mermaid
sequenceDiagram
    participant V as 訪客瀏覽器
    participant E as Rust 引擎(axum)
    participant C as 快取(moka/Valkey)
    participant F as 熱資料層(feature store)

    V->>E: GET 某頁(租戶網址)
    E->>E: 解析租戶 + 載入編譯好的 render plan(op 清單)
    loop 走 op 清單
        alt STATIC
            E->>E: 吐預算好的 Bytes(memcpy)
        else DYN_SHARED
            E->>C: get_with(塊, time_bucket)
            C-->>E: 片段 HTML(命中 / 單飛渲染 + SWR)
        else PER_USER
            E->>F: 查 segment 的推薦清單
            E->>E: 渲染該塊(out-of-order)
        end
    end
    E-->>V: 先吐 外殼 + STATIC + DYN_SHARED(TTFB 極小)
    E-->>V: PER_USER 片段串流補上
    V->>V: WC islands hydrate(只載用到的、加互動)
```

> v1 全是 STATIC:上圖只走 STATIC 分支 + 快取吐 HTML;DYN_SHARED / PER_USER / 串流是 v2/v3 才亮的路。

## 流程二:商家編輯 → 發布

```mermaid
sequenceDiagram
    participant M as 商家(React 編輯器)
    participant A as 編輯 API(Rust)
    participant D as 資料(草稿 / 發布)
    participant K as 編譯器 + 快取

    M->>A: 開啟頁面草稿
    A-->>M: 草稿 JSON(頁面 = 區塊樹)
    loop 編輯(不打網路)
        M->>M: 改設定 → 同一顆 WC 在 client 即時重繪
    end
    M->>A: 存草稿
    A->>D: 寫草稿
    M->>A: 發布
    A->>D: 草稿 → 發布版(publish_version++)
    A->>K: 編譯 render plan(op 清單)+ 清該頁舊快取
    A-->>M: 發布完成
    Note over M: 之後訪客請求即走新版(見流程一)
```

## 流程三:共用區段組(header/footer)發布

```mermaid
sequenceDiagram
    participant M as 商家
    participant A as 編輯 API
    participant K as 編譯器 + 快取

    M->>A: 改 header 區段組 → 發布
    A->>K: 重編該區段組 + 清「所有引用它的頁」的快取
    Note over K: 全站每頁下次請求都吐新的 header
```

## 待補流程(後續版本)

- 資料型區塊接商品中心(商品清單 / 分類)——等商品中心就緒。
- 個人化區塊接推薦(feature store)——v3。
- 圖片資產上傳。
