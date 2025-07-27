# Framecomms

**Extreme work in progress**

Basics of normalized/standardised iframe communication intended to be a lightweight alternative to `@krakenjs/zoid`

[Framecomms on npm](https://www.npmjs.com/package/framecomms)

```sh
npm i framecomms
```

### Parent

Run on host page, this creates and controls your iframes. Pass properties, Call functions, get returns, events etc from subscribers

```typescript
import {parent} from 'framecomms/parent'

const parentPage = parent({
  id: 'parent',
})

const myIframe = parentPage.createIframe({
  src: '',
})

myIframe.render('#query_to_element')
```

Create multible iframes

```typescript
import {parent} from 'framecomms/parent'

const parentPage = parent({
  id: 'parent',
})

const myFrame = parentPage.createIframe({
  src: '',
})

myFrame.render('#query_to_element')

const myFrame2 = parentPage.createIframe({
  src: '',
})

myFrame2.render('#query_to_element_2')
```

### Subscriber

Handles comunication with pulisher. Get props, call functions on parent page or other iframes, get returns, events etc from parent

```typescript
import {connectTo} from 'framecomms/subscriber'

const insideIframe = connectTo({
  id: 'parent',,
})

insideIframe.call('parentPageFn', {id: 1})
```

## Docs

### Functions

Add functions to `available` object, and they will be available for subscribers / parent.
You can also add `available` later with `.addAvailable({})` property function.

Host page:

```typescript
import {parent} from 'framecomms/parent'

const parentPage = parent({
  id: 'parent',
  available: {
    parentFn: (property) => {
      return property + 10
    },
  },
})

const myIframe = parentPage.createIframe({
  src: '',
})

myIframe.render('#query_to_element')
```

Inside iframes:

```typescript
import {connectTo} from 'framecomms/subscriber'

const insideIframe = connectTo({
  id: 'parent',
  available: {},
})

insideIframe.call('parentFn', 10).then((result) => {
  console.log(result) // 20
})
```

### Properties

Values that are not functions in `available` object can be accessed from `get` function

Host page:

```typescript
import {parent} from 'framecomms/parent'

const parentPage = parent({
  id: 'parent',
  available: {
    userId: 10,
  },
})

const myIframe = parentPage.createIframe({
  src: '',
})

myIframe.render('#query_to_element')
```

Inside iframes:

```typescript
import {connectTo} from 'framecomms/subscriber'

const insideIframe = connectTo({
  id: 'parent',
  available: {},
})

console.log(insideIframe.get('userId')) // 10
```

### Events

Listen and emit events from subscribers / parent

#### Custom events

Host page:

```typescript
import {parent} from 'framecomms/parent'

const parentPage = parent({
  id: 'parent',
})

const myIframe = parentPage.createIframe({
  src: '',
})

myIframe.render('#query_to_element')
parentPage.emit('my event', {userId: 10})
```

Inside iframes:

```typescript
import {connectTo} from 'framecomms/subscriber'

const insideIframe = connectTo({
  id: 'parent',
  available: {},
})

insideIframe.on('my event', (data) => {
  console.log(data) // {userId: 10}
})
```

#### Built-in events

There are a few built-in events available, which can be imported from 'framecomms/constants'. These events can be listened to by both parents and subscribers.

Host page:

```typescript
import {parent} from 'framecomms/parent'
import {
  onSubscriberEvent,
  onFrameLoadedEvent,
  onConnectedEvent,
} from 'framecomms/constants'

const parentPage = parent({
  id: 'parent',
})
const myIframe = parentPage.createIframe({
  src: '',
})

myIframe.render('#query_to_element')

parentPage.on(onFrameLoadedEvent, () => {
  // iframe has loaded
})

parentPage.on(onSubscriberEvent, () => {
  // new subscriber connected
})
```

Inside iframes:

```typescript
import {connectTo} from 'framecomms/subscriber'
import {
  onSubscriberEvent,
  onFrameLoadedEvent,
  onConnectedEvent,
} from 'framecomms/constants'

const insideIframe = connectTo({
  id: 'parent',
  available: {},
})

insideIframe.on(onConnectedEvent, () => {
  // connected to parent page
})
```
