# Framecomms

**Extreme work in progress**

Basics of normalized/standardised iframe communication intended to be a lightweight alternative to `@krakenjs/zoid`

[Framecomms on npm](https://www.npmjs.com/package/framecomms)

```sh
npm i framecomms
```

### Publisher

Run on host page, this creates and controls your iframe. Pass properties, Call functions, get returns, events etc from subscribers

```typescript
import {createIframe} from 'framecomms/publisher'

const parentPage = createIframe({
  id: 'my-frame',
  src: '',
})

parentPage.render('#query_to_element')
```

### Subscriber

Handles comunication with pulisher. Get props, call functions on parent page, get returns, events etc from publisher

```typescript
import {connectTo} from 'framecomms/subscriber'

const insideIframe = connectTo({
  id: 'my-frame',,
})

insideIframe.call('parentPageFn', {id: 1})
```

## Docs

### Functions

Add functions to `available` object, and they will be available for subscribers / publisher.
You can also add `available` later with `.addAvailable({})` property function.

```typescript
import {createIframe} from 'framecomms/publisher'

const parentPage = createIframe({
  id: 'my-frame',
  src: '',
  available: {
    parentFn: (property) => {
      return property + 10
    },
  },
})
parentPage.render('#query_to_element')
```

```typescript
import {connectTo} from 'framecomms/subscriber'

const insideIframe = connectTo({
  id: 'my-frame',
  available: {},
})

insideIframe.call('parentFn', 10).then((result) => {
  console.log(result) // 20
})
```

### Properties (_Subject to change_)

Values that are not functions in `available` object can be accessed from `window.framecommsProps`

```typescript
import {createIframe} from 'framecomms/publisher'

const parentPage = createIframe({
  id: 'my-frame',
  src: '',
  available: {
    userId: 10,
  },
})
parentPage.render('#query_to_element')
```

```typescript
import {connectTo} from 'framecomms/subscriber'

const insideIframe = connectTo({
  id: 'my-frame',
  available: {},
})

console.log(window.framecommsProps.userId) // 10
```

### Events

Listen and emit events from subscribers / publisher

#### Custom events

```typescript
import {createIframe} from 'framecomms/publisher'

const parentPage = createIframe({
  id: 'my-frame',
  src: '',
})
parentPage.render('#query_to_element')
parentPage.emit('my event', {userId: 10})
```

```typescript
import {connectTo} from 'framecomms/subscriber'

const insideIframe = connectTo({
  id: 'my-frame',
  available: {},
})

insideIframe.on('my event', (data) => {
  console.log(data) // {userId: 10}
})
```

#### Built-in events

There are a few built-in events available, which can be imported from 'framecomms/constants'. These events can be listened to by both publishers and subscribers.

```typescript
import {createIframe} from 'framecomms/publisher'
import {
  onSubscriberEvent,
  onFrameLoadedEvent,
  onConnectedEvent,
} from 'framecomms/constants'

const parentPage = createIframe({
  id: 'my-frame',
  src: '',
})
parentPage.render('#query_to_element')

parentPage.on(onFrameLoadedEvent, () => {
  // iframe has loaded
})

parentPage.on(onSubscriberEvent, () => {
  // new subscriber connected
})
```

```typescript
import {connectTo} from 'framecomms/subscriber'
import {
  onSubscriberEvent,
  onFrameLoadedEvent,
  onConnectedEvent,
} from 'framecomms/constants'

const insideIframe = connectTo({
  id: 'my-frame',
  available: {},
})

insideIframe.on(onConnectedEvent, () => {
  // connected to parent page
})
```
