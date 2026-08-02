import { css } from 'lit'

// 區塊共用基礎 reset(每個區塊的 static styles 都吃):
// box-sizing 統一、清掉語意元素(p / 標題 / list)的瀏覽器預設 margin/padding。
// 這樣文字用 <p> 也不會多一圈預設留白。
export const resetStyles = css`
  :host,
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  h1, h2, h3, h4, h5, h6, p, figure, blockquote, dl, dd, ul, ol {
    margin: 0;
    padding: 0;
  }
  ul, ol {
    list-style: none;
  }
  a {
    color: inherit;
    text-decoration: none;
  }
  img {
    max-width: 100%;
    display: block;
  }
  button {
    font: inherit;
  }
`
