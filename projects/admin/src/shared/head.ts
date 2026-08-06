// 分頁標題的唯一組法。站名同時給 BaseLayout 的 ProLayout 用,避免兩處各寫一份然後走鐘。
// index.html 的 <title> 是 JS 載入前的保底值,無法共用這個常數 —— 改站名時記得一起改。
export const SITE_NAME = '電商後台'

export const pageTitle = (name: string) => `${name} - ${SITE_NAME}`
