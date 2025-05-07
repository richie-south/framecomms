# framecomms

```typescript
// page 1

const pageOne = createIframe({
  id: 'my-frame',
  src: '',
  available: {
    pageOneFn: (params) => {
      console.log('called pageOneFn', params)
    },
  },
})

// page 2

const pageTwo = connectToIframe({
  id: 'my-frame',
  available: {
    pageTwoFn: () => {
      console.log('called pageTwoFn')
    },
  },
})

pageTwo.call('pageOneFn', {id: 1})
```
