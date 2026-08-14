import { defineMock } from 'vite-plugin-mock-dev-server'
import { makeTemplateEndpoints } from './_endpoints'

export default defineMock(
  makeTemplateEndpoints({
    base: '/api/headers',
    kind: 'header',
    key: 'headers',
    idPrefix: 't-hdr-new',
  }),
)
