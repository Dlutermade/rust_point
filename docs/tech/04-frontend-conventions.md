# 04 — 前端規約:TypeScript / React 命名與組織

> 狀態:**團隊既有標準**,2026-08-05 落地到本 repo。適用 `projects/admin` 與 `projects/blocks`。
> 沒有 linter 能全自動檢查這些,所以寫在這裡;review 時以本文為準,不憑感覺。

## 1. 檔案與資料夾

| 類型 | 規則 | 範例 |
|------|------|------|
| React Component 檔案 | PascalCase | `OrderList.tsx`、`UserProfile.tsx` |
| Component 資料夾 | PascalCase + `index.tsx` 作入口 | `notification/Line/index.tsx` |
| Hooks | camelCase,`use` 開頭 | `useAudience.ts` |
| Utils / Helpers | camelCase | `formatDate.ts`、`apiClient.ts` |
| 分類資料夾 | camelCase | `components/`、`hooks/`、`utils/`、`modules/` |
| 常數檔 | camelCase | `constants.ts`、`config.ts` |

## 2. Component 命名

**核心**:名稱要同時說出「是什麼」與「長什麼樣」,用一致後綴提升可讀性。

- **展示型** = `{主體}{呈現方式}` —— `OrderCard`、`OrderList`
- **功能型** = `{主體/狀態}{功能}{呈現方式}` —— `OrderSearchBlock`、`SmartRadioCard`

| 類型 | 後綴 | 範例 |
|------|------|------|
| 功能區塊 | `~Block` | `OrderSearchBlock` |
| 彈窗 | `~Modal` | `ConfirmModal` |
| 按鈕 | `~Button` | `SubmitButton` |
| 表單 | `~Form` | `LoginForm` |
| 表格 | `~Table` | `OrderTable` |
| 清單 | `~List` | `OrderList` |
| 卡片 | `~Card` | `OrderCard` |
| 網格 | `~Grid` | `ProductGrid` |

**要避開的**

- 命名不明確:`<Search />`(按鈕還是區塊?)、`<User />`(卡片還是表單?)、`<Confirm />`
- 冗詞 vs 獨立主體:`OrderItem` 若指「訂單下的購買項目」,它本身就是主體 → `OrderItemCard`,不是 `OrderCard`
- 按鈕觸發的彈窗,本質是彈窗:`OrderCreateModal`(可用 `trigger` prop 自帶按鈕),不是 `OrderCreateButton`

### Container 模式

需要絕對切割資料與 UI 時,用 `{原始名稱}Container`:UI Component 純展示、只吃 props;Container 負責 `useQuery` / `useMutation` 再往下傳。

**適合**:要分層、同一 UI 接不同資料源、要單獨測 UI。
**不適合**:多個 query 需要各自 loading / skeleton、不會被複用、頁面級且資料與 UI 綁死。

## 3. 變數、常數、型別

| 類型 | 規則 | 範例 |
|------|------|------|
| 常數 | UPPER_CASE | `API_BASE_URL`、`MAX_RETRY_ATTEMPTS` |
| 變數 / 函式 | camelCase | `userName`、`fetchCampaigns` |
| Component | PascalCase | `CampaignList` |
| Type / Interface | PascalCase | `CampaignData` |
| Component props | `{元件名}Props`,**具名、不可 inline** | `type OrderTableProps = { ... }` |

### props 型別一律具名

```tsx
// ❌ 型別字面量直接寫在參數上:名字無處可引用,元件一長就讀不動
function StatusTag({ template }: { template: PageTemplate }) {}

// ✅ 抽成 {元件名}Props
type StatusTagProps = {
  template: PageTemplate
}

function StatusTag({ template }: StatusTagProps) {}
```

同一檔案裡的子元件也各自具名(`SlotPickerProps`、`OptionCardProps`),不共用一個。

## 4. 函式命名

### 動詞前綴(單一明確動作)

| 前綴 | 用途 |
|------|------|
| `get*` | 從原始資料取得子集 |
| `gen*` | 從原始資料產生衍生值 |
| `transfer*` | 單向轉換成新值 |
| `check*` | 執行檢查並回傳布林 |
| `has*` | 判斷是否擁有某屬性 / 狀態 |

⚠️ **禁止 `is` 開頭的函式名**(會跟狀態變數混淆)—— `isUserValid()` → `checkUserIsValid()`。

### 名詞後綴(代表一個功能模組 / 可重用工具)

`*Validator`、`*Formatter`、`*Transformer`、`*Parser`、`*Builder`、`*Handler`、`*Filter`、`*Mapper`。

`transfer*` 是單向轉換;`*Mapper` 是雙向(`toApiPayload` / `fromApiResponse`)。

**選擇原則**:一次性的檢查邏輯用動詞前綴;可重用的工具用名詞後綴。

### 靜態映射表用 `gen*` 產生

要支援多語系時,`const STATUS_TEXT_MAP = {...}` 應改為 `genStatusTextMap(t)`。

### 送出前先轉換

不要把表單值直接丟給 API(會夾帶 UI 狀態、暫時欄位)。用 `transferFormValuesToCreatePayload()` 組出乾淨的請求物件。

## 5. 事件處理函式

**格式 `on[Action][Subject]`**,例:`onCreateCampaign`、`onChangeTab`、`onCloseModal`、`onSubmitForm`。

常見動作:Create / Update / Delete / Change / Select / Click / Submit / Close / Open / Toggle。

⚠️ **禁止 `handle` 開頭** —— `handleCreateOrder` → `onCreateOrder`。

**該用 `on`**:回應使用者操作、處理 DOM 事件、當作 props 往下傳的回呼。
**不該用 `on`**:內部邏輯(過濾 / 計算 / 轉換)、工具函式、生命週期邏輯。

```tsx
// ❌ 這不是事件處理
const onFilterProducts = (products: Product[]) => products.filter((p) => p.inStock)
// ✅
const getInStockProducts = (products: Product[]) => products.filter((p) => p.inStock)
```

**props 與內部函式撞名時,重命名 props**:

```tsx
function CampaignForm({ onCreateCampaign: propsOnCreateCampaign }) {
  const onCreateCampaign = async (data: CampaignData) => {
    const validated = validateCampaignData(data)
    await propsOnCreateCampaign?.(validated)
  }
}
```

## 6. 布林命名

**狀態變數用過去式**:`isOpened`、`isActivated`、`isCompleted`、`isSelected`。

避免現在式(`isOpen` —— 是「正在開」還是「已開」?)、避免動詞(`showModal`、`hidePanel`、`visibleSidebar`)。

| ❌ | ✅ |
|---|---|
| `showCreateModal` | `isOpenedCreateModal` |
| `sidebarVisible` | `isOpenedSidebar` |
| `editMode` | `isActivatedEditMode` |
| `formSubmitted` | `isSubmittedForm` |

**setState 名稱要對應**:`const [isOpened, setIsOpened]`,不是 `setOpen`。

**簡單判斷變數** 用 `is{Condition}`:`isLoading`、`isEmpty`、`isDisabled`。

**檢查其他主體的狀態** 用 `checked{Subject}{Condition}`:`checkedBuyerHasExtension`、`checkedUserHasPermission` —— 名字要看得出是布林,不是物件。

## 7. 程式碼組織

**按功能分組**,不要「所有 state 放一起、所有 callback 放一起」。同一個功能的 state / memo / callback 擺在一起。

**區塊註解**(元件超過 200–300 行、或有 3 個以上功能區塊時):

```tsx
// ============================================================================
// Order Filtering & Display (訂單過濾與顯示)
// ============================================================================
```

**單行註解寫在程式碼上方**,不寫行尾(極短的單位說明如 `// ms` 例外)。

標籤:`TODO` / `FIXME` / `NOTE` / `HACK` / `WARNING`。

## 8. Lodash

優先使用 lodash 而非手刻:

- 安全取值 `get(obj, ['a','b'], default)`(避免 `?.` 搭 `||` 讓 0 / '' 變成預設值)
- 陣列 `uniqBy` `groupBy` `sumBy` `meanBy` `differenceBy` `intersectionBy` `unionBy` `flatten` `chunk` `orderBy` `find`
- 物件 `set` `mapValues` `mapKeys` `cloneDeep` `merge` `isEmpty` `pick` `omit`
- 函式 `debounce` `throttle` `sample` `shuffle`
- `size()` 用在可能是 null / undefined 時;一般情況直接 `.length`

## 9. React Hooks

**最高原則:多數情況不需要 `useMemo` / `useCallback`。** 過度使用只增加複雜度與記憶體開銷。

**該用**:傳 object / array / function 給子元件當 props、當作其他 hook 的 dependency、計算成本高、傳給 `React.memo` 包過的元件。

**不該用**:原始型別、簡單計算、不往下傳的值。

**兩條硬限制**

1. **props 傳遞最多三層**,超過要用 Context、custom hook 收斂,或重新檢視元件是否過度拆分。
2. **不要連續三層以上對同一個值做記憶化加工**(`useMemo` 疊 `useMemo`)。

單純的 prop drilling 本身不是問題;問題是多層各自加工同一個值。

⚠️ TanStack Query 的 `queryKey` **不需要** `useMemo` —— 它內部用 hash 比對值,不看 reference。

## 10. 本 repo 的落差與待決

導入時盤點的結果,尚未全部收斂。

**待決**

| # | 事項 |
|---|------|
| 1 | 多字模組資料夾大小寫。規範寫 camelCase 但沒有多字範例;現況是 kebab-case(`components/page-template/`、`components/block-editor/`) |
| 2 | Component 後綴清單不夠用。編輯器那批(`BlockTreeEditor`、`PreviewCanvas`、`SelectionOverlay`、`SettingsPanel`、`ContentField`、`BlockView`)沒有一個套得進現有八個後綴 —— 要擴充清單還是硬套 |
### 已定案

**`components/ui/` 放跨領域 UI 原語**(2026-08-06)。`components/` 底下原本只有 `page-template/`、`block-editor/` 兩個**領域**模組,不屬於任何領域的小元件無處可放 —— `Kbd`(鍵盤按鍵樣式)因此寄生在 `routes/_layout/helps/page-editor.tsx` 裡,是 13 個 route 檔中唯一一個「route 檔內另外定義元件」的例外。已移到 `components/ui/Kbd.tsx`。

route 檔只放 route 元件本身;要在頁面裡拆小元件,就放進 `components/` 對應的模組。

### 附:為什麼不引 shadcn(2026-08-06 討論)

admin 已是 antd 6 + pro-components,`ProTable` / `ProForm` / `ProLayout` 扛主要工作而 shadcn 沒有對應物 —— 引入是「加第二套設計系統」不是取代。代價:第三套 token(這個 repo 才剛修完 antd token 與 Tailwind body 的字級不一致)、自己維護元件卻仍鎖著 antd(shadcn 的賣點被抵銷)。前台 `projects/blocks` 是 Lit web components(framework-free,配 Rust SSR),shadcn 是 React-only 也幫不上。

要「小原語自己掌控」不需要新相依 —— Tailwind 已在,`components/ui/` 就是那個位置(見待決 3)。

**已修正**(2026-08-06)

事件處理 `on[Action][Subject]`、`checkIsDescendant()`、布林 `is` + 過去式、短名全數具名化、模組常數 UPPER_CASE、`gen*` 前綴、`.then()` → `async/await` + 處理 reject(unhandled rejection 消失)、props 型別全部具名(31 個 `XxxProps`,原本 0 個)、antd deprecated API 清零(8 處)。

**仍待處理**

- **lodash 裝了完全沒用**:`lodash-es` 在 dependencies,`src` 零個 import —— 要嘛開始用要嘛移除
- **props 超過三層**:`route → TemplateForm → ContentField → BlockTreeEditor → PreviewCanvas → SelectionOverlay`,五到六層
- 超過 200 行未加區塊註解:`BlockList`(393)、`BlockTreeEditor`(374)、`SettingsPanel`(357)、`HomeChromePicker`(302)、`SelectionOverlay`(273)、`PreviewCanvas`(213)
- 元件名待後綴清單定案(見待決 2)

## 11. components 的分層

```
components/
  page-template/        模板管理(領域)
    StatusTag.tsx         ← 共用
    AuditDrawer.tsx       ← 共用
    home/                 首頁:TemplateForm · publishConfirm · TargetingFields · TargetingTags · ChromePicker
    header/               頁首:TemplateForm · publishConfirm
    footer/               頁尾:TemplateForm · publishConfirm
  block-editor/         積木編輯器(領域)
  ui/                   跨領域 UI 原語
```

### 共用 vs 各版位:判準

**看它描述的是「模板本身」還是「某個版位的情境」**,不是看有幾個地方引用。

| | 判定 | 為什麼 |
|---|---|---|
| `StatusTag`、`AuditDrawer` | **共用** | 草稿 / 已發布 / 暫停、異動紀錄都是 `PageTemplate` 的屬性,換版位不變 |
| `TemplateForm` | **各版位一份** | 欄位組成本來就不同:首頁有生效條件 / 外框覆寫 / 上下文預覽,外框沒有 |
| `publishConfirm` | **各版位一份** | 首頁攤生效資訊表,外框只有凍結提醒,文案也不同 |
| `TargetingFields`、`TargetingTags`、`ChromePicker` | **只在 home** | 只有首頁有生效條件與外框覆寫 |

**徵兆**:硬要共用時,差異會變成參數。拆開前 `genPublishConfirm` 吃 `kind: 'page' | 'chrome'`、表單吃 `frame`,拆開後這些參數自己消失 —— 各版位知道自己是誰,不用被告知。

⚠️ 反過來也要小心:共用件現在三邊同形才共用。哪天某版位的狀態機長出自己的樣子(例如頁首多一個「排程中」),就拆進該版位,不要加 `kind` 參數。
