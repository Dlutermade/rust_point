# 0006 — admin:前端規約落地、版位拆分

> 日期:2026-08-06。admin review 的第二輪(接 [0005](0005-admin-review.md))。storefront-center(Rust)未動。
> review 尚未結束,下一輪繼續。

## 狀態

- **規約進 repo**:[`docs/tech/04-frontend-conventions.md`](../tech/04-frontend-conventions.md) —— 團隊的 TS/React 命名與組織標準,加上本 repo 的落差盤點與待決。先前這套只存在於對話裡。
- **命名規約全面套用**:44 個 ts/tsx 掃出 27 個有違反,改了 32 個檔。事件處理 `on[Action][Subject]`、`checkIsDescendant()`、布林 `is` + 過去式、react-query 加 `Query` / `Mutation` 後綴、短名全數具名化、模組常數 UPPER_CASE、`gen*` / `transfer*` 前綴。
- **props 型別全部具名**:31 個 `XxxProps`(原本 **0 個**)+ 3 個 `SubmitArgs`,inline 型別清零。
- **`.then()` → `async/await`**:12 處。原本 `form.validateFields()` 驗證失敗會 reject 而沒有 catch —— 使用者每按一次沒填完的表單就產生一個 unhandled rejection。
- **antd deprecated 清零**:8 處(`Alert.message`→`title`、`Steps.direction`→`orientation`、Steps items 的 `description`→`content`、`Descriptions.labelStyle`→`styles.label`、`Descriptions` children→`items`)。
- **分頁標題交給 router**:`__root.tsx` 掛 `HeadContent`,13 個 route 各自宣告 `head`;`index.html` 補 `noindex`。
- **`components/` 重新分層**:`page-template/` 底下按版位拆成 `home/` `header/` `footer/`;`Kbd` 移出 route 檔到新的 `components/ui/`。

## 決策

- **共用的判準:看它描述的是「模板本身」還是「某個版位的情境」**,不是看有幾個地方引用。`StatusTag` / `AuditDrawer` 是模板的屬性 → 共用;`TemplateForm` / `publishConfirm` 是「這個版位怎麼編輯 / 怎麼發布」→ 各版位一份。判準與完整結構見規約文件 §11。
- **硬要共用時,差異會變成參數**。拆開前 `genPublishConfirm` 吃 `kind: 'page' | 'chrome'`、表單吃 `frame`,拆開後這些參數自己消失。這是「該不該共用」最好用的徵兆。
- **不引 shadcn**。admin 已是 antd + pro-components,`ProTable` / `ProForm` / `ProLayout` 沒有對應物 —— 引入是加第二套設計系統,代價是第三套 token;而且前台 `blocks` 是 Lit,React-only 的方案幫不上。要「小原語自己掌控」用 `components/ui/` + Tailwind 即可,零新相依。
- **表單不管頁面外殼**。`PageContainer`(標題 / 返回 / 底部動作)提回 6 個 route —— route 才是「頁面」,表單只負責表單。
- **`components/ui/` 放跨領域 UI 原語**;route 檔只放 route 元件本身。

## 註(踩到的坑)

- **antd Button 不支援 promise 自動 loading**(6.5.3 實測:`Button.js` 直接丟掉 `onClick` 回傳值)。支援的是 `ActionButton` —— Modal / Popconfirm 的確認鈕,`Modal.confirm` 的 `onOk` 我們本來就在用。一般按鈕仍需自己給 `loading`。
- **ProLayout 會指令式改寫 `document.title`**,而且跟著**選單項**比對 —— 不在選單裡的頁面(詳細 / 新建)只剩站名。`pageTitleRender={false}` 擋不乾淨,得連 `title` prop 一起不傳,品牌改用 `headerTitleRender` 自己畫(否則掉回預設的「Ant Design Pro」)。
- **`index.html` 的靜態 `<title>` 會贏過 HeadContent 掛上去的**(瀏覽器取文件裡第一個),初次載入永遠顯示保底值。已移除。
- **deprecated 掃描有三個盲點**:JSX 屬性要走 contextual type 才拿得到符號;物件字面量的屬性(如 Steps 的 `items`)同理;標在 `children` 上的(`Descriptions`)完全掃不到,只能讀型別定義。`tsc` 本身不報 deprecated。

## 下一輪

1. **繼續 admin review**(未完)。
2. **後端 `publish` 的 patch 太窄**:`PublishPatch` 只有 `content` / `targeting`,收不了 `name` / `chrome`,所以前端「發布」要打兩次 API(先 `saveDraft` 再 `publish`)。代價是不原子、且每次發布都灌一筆多餘的 `save-draft` 審計。正解在後端 —— 併進 **M2 code review**。
3. lodash:開始用或移除(現在裝了零 import)。
4. props 五到六層 → Context 或重構(規約寫最多三層)。
5. 六個超過 200 行的檔案加功能分組區塊註解。

## 還需要決策

| # | 事項 |
|---|------|
| 1 | 多字模組資料夾大小寫:規範寫 camelCase,現況 kebab-case(`page-template` / `block-editor`) |
| 2 | Component 後綴清單容不下 `Editor` / `Canvas` / `Panel` / `Overlay` / `View` / `Tag` / `Drawer` —— 擴充清單還是硬套。9 個元件卡著,新增元件也會再撞 |

(0005 的待決 1 glossary 對齊 Model B、2 Page 拆解、3 orval 時機仍未動。)
