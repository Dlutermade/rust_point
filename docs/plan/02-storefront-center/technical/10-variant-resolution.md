# 10 — 變體解析(決策層:挑哪個變體)

> 技術視角:render(見 02)**之前**的**決策層**——先 resolve 出「這個請求該用哪個變體」,再走它的 render-plan。純函式、可快取,是個人化 SSR 的入口決策。
> **先規劃不實作**:v1 只做「時間窗 + 常態預設」,受眾 / 來源 / 優先序留 seam。

## 定位:渲染之前先「選版本」

```
請求 ─► [變體解析] ─► 選出一個變體 ─► 該變體的編譯 render-plan ─► 渲染引擎(02)
```

02 負責「**怎麼把選定的頁面渲染快**」;本層負責「**選哪個版本**」。串接:解析輸出的變體 → 它的 op 清單 → 熱路徑吐出。

## 兩種解析:頁面跑完整生效,外框只有站台預設(Model B)

「生效」(排程 / 定向 / 優先序)是**頁面**的事;**頁首 / 頁尾是外框**,不跑完整生效。外框怎麼決定 = 三支柱:

1. **站台預設**:每個版位選一個 active 變體當全站預設(`isDefault`;同版位唯一)。
2. **頁面覆寫**:個別頁面可指定要套哪個頁首 / 頁尾(`chrome.headerId` / `chrome.footerId`);沒指定 = 跟隨站台預設。
3. **內部個人化**:登入 / 未登入這種切換,由頁首組件**自己內部**處理(component 內對登入態反應),**不靠變體**。

對應兩支純函式:

```
resolveChrome(variants)        -> 外框:active 中取 isDefault,沒有就取第一個 active
resolveVariant(variants, ctx)  -> 頁面:完整 filter(status ∧ 時間 ∧ 受眾 ∧ 來源)→ sort(priority)
```

實際生效內容 = `頁面.chrome.headerId ? 取該頁首 : resolveChrome(頁首群)`,頁尾同理。**外框不吃 `targeting`**:頁首 / 頁尾變體即使帶 schedule / audience 也被忽略——那是頁面才有的維度。下方 filter→sort 演算法只適用 `resolveVariant`(頁面)。

## 變體帶的規則(全 optional)

物件包裹、欄位明確;**沒設的維度 = 該維度永遠命中**。

```json
{
  "targeting": {
    "schedule": { "start": "2026-08-01T00:00:00+08:00", "end": "2026-08-14T23:59:59+08:00" },
    "audience": { "login": "required" },
    "source": { "utm": ["summer-sale"], "locale": ["zh-TW"], "geo": ["TW"] },
    "priority": 100
  }
}
```

- `audience.login`:`required`(有登入)/ `guest`(無登入)/ 省略(不判斷)——**v1 只看登入這一維**;會員等級 / 分眾 v2 再加。
- `source`:`utm` / `locale`(語系)/ `geo`(地理);沒設 = 任何。device 等 v3。
- 常態版:無 `targeting`(或全空)、`priority` 最低。

## 解析演算法:filter → sort(先篩後排)

```
resolve(now, visitor, source) -> Variant

1. FILTER  留下「啟用中 且 條件全中」的變體(AND;沒設的維度視為命中)
     status   : 已發布且啟用中           (草稿 / 暫停 = 排除)
     schedule : now ∈ [start, end]     (無 = 永久)
     audience : visitor 命中            (無 = 所有人)
     source   : request 命中            (無 = 任何)
   ↳ 時間最便宜、最有選擇性 → 先剪枝(效能);但邏輯是 AND、非逐級關卡。

2. SORT    對存活者排名
     priority desc
       ↳ 平手 → specificity(條件多 / 有受眾者 勝過常態)
         ↳ 再平手 → 最近發布 / 核准先後

3. PICK    取第一個
```

## 不變式:常態版兜底,免特判

每個版位**恆有一個常態版**:無條件 → **永遠通過 filter**;優先序最低 → **永遠排最底**。故:

- **沒有任何特別變體符合 → 常態版自動勝出**(它只是「永遠合格、排最後」的普通候選)。
- resolve **永遠有解**,不需要 `if (candidates.empty) return default` 這種分支。

## 性質:純函式 → 可快取

`resolve` 無副作用、無隨機:給定 `(now 粗化到 bucket、visitor 的 segment、source)` → 確定的變體。→ 解析結果**可快取**,快取鍵用 **segment 粗投影**(對齊 02 的命門:能用 segment 就別用 user)。解析得到的 segment / source 也正好餵 02 的 `PER_USER` 快取鍵。

## 生命週期與治理

- **狀態**:`草稿(draft)` → `已發布(active)` → `暫停(paused)`。草稿不參與解析;發布才上線。
- **草稿可編、發布即凍結**:草稿階段 content + targeting 都可改;**存檔時選「儲存為草稿」或「直接發布」**。**一經發布就凍結**(content + targeting 不可再改);要改 = **複製成新變體**(clone → 新版本)——**複製是一等公民**。→ 已發布的變體在後台**開啟即唯讀(檢視)**,非編輯。
- **只有兩個可變槓桿**:`priority`(重疊時重排)、`status`(**暫停 / 恢復**;暫停者不參與解析)。
- **異動紀錄(audit log)**:建立 / 複製 / 調優先序 / 暫停 / 恢復 每筆記(誰、何時、做了什麼)→ 可回溯「任一時刻線上是什麼」。
- **為何不可編輯**:排程 / 定向一旦上線,**就地改會靜默改變訪客看到的、也毀了可回溯性**;不可變 + 版本化 + audit 才安全(對齊 feature flag / 實驗 / 促銷的治理做法)。

## 分期(合「先規劃不實作」)

| 版 | 做什麼 |
|----|--------|
| **v1** | **schedule(時間窗)+ 常態版兜底 + audience(登入三態)+ source(utm / locale / geo)+ priority + status(暫停/恢復)**;變體**建立即凍結、改用複製、異動紀錄**。resolve = filter(status ∧ 時間 ∧ 受眾 ∧ 來源)→ sort(priority)。 |
| **v2** | 受眾細分:**會員等級 / segment**(segment 由個人化資料層供給)。 |
| **v3** | 更多 source(**device** …)、進階規則、解析結果以 segment 鍵快取、edge。 |

**紀律**:先釘**模型 + `resolve` 純函式簽章**,**不急著造通用引擎**。持久的是「`targeting` 結構 + filter→sort 契約」;受眾 / 來源 / 優先序 slot-in 不重寫。

## 資料存取(擺最後)

- **變體規則**:存變體列的 `targeting` JSONB(**與內容同表**;列表 API 投影不含它,實體 API 才回)。
- **解析輸入**:`now`(伺服器)、`visitor`(cookie / session → segment;登入態、會員等級由會員中心供)、`source`(URL utm / header)。
- **熱路徑**:resolve 只讀(segment 已離線算好進熱資料層),不在熱路徑運算——與 02 鐵律一致。

## 來源

- Feature flag「規則由上到下、first-match、default 兜底」 — https://docs.featbit.co/feature-flags/targeting-users-with-flags/targeting-rules
- Feature flag 排程上線 — https://docs.devcycle.com/platform/feature-flags/targeting/rollouts/
- Adobe Target 活動 priority + 受眾 tiebreak — https://experienceleague.adobe.com/en/docs/target/using/activities/priority
- Headless CMS 元件級個人化(存變體 → decision layer → 渲染) — https://snipcart.com/blog/headless-cms-personalization-lexascms
- Salesforce B2C 促銷依 priority 處理 — https://help.salesforce.com/s/articleView?id=cc.b2c_campaigns_and_promotions.htm&language=en_US&type=5
