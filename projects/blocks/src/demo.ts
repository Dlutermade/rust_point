import { blockTypes } from './index'

// 把每個區塊型別用預設值掛出來,單機視覺驗證。
const gallery = document.getElementById('gallery')
if (gallery) {
  for (const bt of blockTypes) {
    const section = document.createElement('section')
    section.className = 'demo-item'

    const title = document.createElement('h3')
    title.textContent = `${bt.name}  <${bt.tag}>`

    const el = document.createElement(bt.tag) as HTMLElement & { data: unknown }
    el.data = bt.defaults

    section.append(title, el)
    gallery.append(section)
  }
}
