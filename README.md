# framecomms

**Extreme work in progress**

Basics of normalized/standardised iframe communication intended to be a lightweight alternative to `@krakenjs/zoid`

```typescript
// page

const parentPage = createIframe({
  id: 'my-frame',
  src: '',
  available: {
    parentPageFn: (params) => {
      console.log('called parentPageFn', params)
    },
  },
})

// inside iframe

const insideIframe = connectTo({
  id: 'my-frame',
  available: {
    insideIframeFn: () => {
      console.log('called insideIframeFn')
    },
  },
})

insideIframe.call('parentPageFn', {id: 1})
```
