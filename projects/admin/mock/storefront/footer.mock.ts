import { defineMock } from 'vite-plugin-mock-dev-server'
import { makeTemplateEndpoints } from './_endpoints'

export default defineMock(
  makeTemplateEndpoints({
    base: '/api/footers',
    kind: 'footer',
    key: 'footers',
    idPrefix: 't-ftr-new',
  }),
)
