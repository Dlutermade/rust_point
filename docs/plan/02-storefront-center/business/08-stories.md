# 08 — User Story 與驗收條件

> 商業視角。需求以 **User Story** 表達,AC 以 **Gherkin**(`Scenario` + `Given`/`When`/`Then`/`And`)。步驟只講可觀察的商業行為。關鍵字英文、步驟中文、每步一行。
> ⚠️ 早期草擬,待 PO 核對。

---

## 編頁面(拖拉組頁)

> **身為** 商家,**我要** 拖區塊拼出頁面,**好** 不靠工程就客製門面。

```gherkin
Scenario: 加一個區塊
  Given 我在編輯一個頁面
  When 我從區塊庫拖入一個 banner
  Then 該 banner 出現在我放的位置
  And 帶有它的 preset 預設樣子

Scenario: 拖拉排序
  Given 頁面有多個區段
  When 我在結構樹把「促銷」拖到「最新消息」上面
  Then 前台預覽即時反映新順序

Scenario: 並排(排版容器)
  Given 我要一排三張圖並排
  When 我放一個排版容器、裡面放三個圖片區塊
  Then 三張圖在同一列並排顯示

Scenario: 巢狀有上限
  Given 我在容器裡再放容器
  When 巢狀超過 5 層
  Then 系統不允許再往下巢
```

---

## 改設定(依 schema)

> **身為** 商家,**我要** 改區塊的內容與樣式,**好** 符合品牌。

```gherkin
Scenario: 設定表單依型別生成
  Given 我選中一個 banner 區塊
  When 右側設定面板開啟
  Then 顯示該型別 schema 定義的欄位(圖片、文字、連結、顏色…)

Scenario: 改了即時預覽
  Given 我選中一個文字區塊
  When 我改它的文字
  Then 中間預覽即時更新
```

---

## 多裝置

> **身為** 商家,**我要** 讓手機版和桌機版排得不一樣,**好** 兩邊都好看。

```gherkin
Scenario: 手機單獨設值
  Given 我切到手機檢視
  When 我把 Hero 的邊距改小
  Then 手機版套用新邊距
  And 桌機版維持原值
```

---

## 共用區段組

> **身為** 商家,**我要** header / footer 設一次套全站,**好** 全站一致又省事。

```gherkin
Scenario: 改 footer 全站生效
  Given footer 是共用區段組
  When 我在 footer 加一條連結並發布
  Then 全站每一頁的 footer 都出現該連結
```

---

## 草稿與發布

> **身為** 商家,**我要** 編輯時不影響線上,**好** 安心改稿。

```gherkin
Scenario: 草稿不影響訪客
  Given 頁面已發布
  When 我編輯它(尚未發布)
  Then 訪客看到的仍是舊的發布版

Scenario: 發布上線
  Given 我改好了草稿
  When 我按發布
  Then 訪客看到新版
```

---

## SEO / 網址

> **身為** 商家,**我要** 每頁有自己的網址與 SEO,**好** 被搜尋引擎找到。

```gherkin
Scenario: 每頁自帶 SEO
  Given 我在編一個頁面
  When 我設定它的網址、SEO 標題與描述
  Then 該頁以此網址上線
  And 搜尋引擎可索引其標題 / 描述
```

---

## 互動

> **身為** 商家,**我要** 指定按鈕行為,**好** 引導訪客。

```gherkin
Scenario: 按鈕綁動作
  Given 我選中一個按鈕
  When 我從動作目錄選「前往活動頁」
  Then 訪客按該按鈕會前往活動頁
```

---

## 效能 / 多租戶

> **身為** 訪客與商家,**我要** 頁面載得快、各商家互不干擾。

```gherkin
Scenario: 只載用到的區塊
  Given 一個頁面只放了 banner 與圖片
  When 訪客載入該頁
  Then 只載入 banner 與圖片所需資源
  And 未使用的區塊型別不載入

Scenario: 多租戶隔離
  Given 商家 A 與商家 B 各有自己的站
  When A 編輯或發布頁面
  Then B 的頁面與設定完全不受影響、互不可見
```
