import { css } from 'lit'

// 每個區塊的 static styles 都吃這份:只中和瀏覽器預設(box model、語意元素的留白),
// 不做設計主張 —— 連結底線 / 清單樣式歸各區塊自己決定,全域清掉會連帶清掉可及性。
export const resetStyles = css`
  :host,
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p,
  figure,
  blockquote,
  dl,
  dd,
  ul,
  ol {
    margin: 0;
    padding: 0;
  }
  img {
    max-width: 100%;
    display: block;
  }
  button {
    font: inherit;
  }
`
