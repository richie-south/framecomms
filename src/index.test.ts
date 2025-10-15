import {Page, test} from '@playwright/test'
import fs from 'fs'
import path from 'path'

declare global {
  interface Window {
    testFramecomms: any
    framecommsProps: any
  }
}

const libPath = path.resolve(__dirname, '../dist/testFramecomms.umd.js')
const libCode = fs.readFileSync(libPath, 'utf8')

async function setUp({page, pageCode}: {page: Page; pageCode: string}) {
  page.on('pageerror', (err) => {
    console.error('Page error:', err.message)
  })

  page.on('crash', () => {
    console.error('Page crashed!')
  })

  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <body>
        <div id="child"></div>
        <div id="child2"></div>
        <script>
          ${libCode}
          ${pageCode}

        </script>
      </body>
    </html>
  `)

  const iframesHandles = await page.$$('iframe')
  return await Promise.all(
    iframesHandles.map(async (iframeHandle) => {
      // Use srcdoc to define an initial HTML with a script placeholder
      await iframeHandle!.evaluate((el) => {
        el.setAttribute('srcdoc', '<html><body></body></html>')
      })

      // Wait for iframe to load
      const frame = await (await iframeHandle!.contentFrame())!

      // Inject libCode in the iframe
      await frame.evaluate((code: string) => {
        const script = document.createElement('script')
        script.type = 'text/javascript'
        script.textContent = code
        document.body.appendChild(script)
      }, libCode)

      return frame
    }),
  )
}

test('should connect to parent from iframe', async ({page}) => {
  const waitForConsoleLog = new Promise<void>((resolve) => {
    page.on('console', (msg) => {
      const text = msg.text()

      if (text === 'connected') {
        resolve()
      }
    })
  })
  const pageCode = `
    const parentPage = testFramecomms.parent({
      id: '1',
      options: {origin: '*'}
    })

    const myFrame = parentPage.createIframe({
      src: '',
    })

    myFrame.render('#child')
  `

  const frames = await setUp({page, pageCode})
  const frame = frames[0]

  await frame.evaluate(() => {
    if (!window.testFramecomms) {
      return
    }

    const insideIframe = window.testFramecomms.connectTo({
      id: '1',
    })

    insideIframe.on('@FRAMECOMMS/onConnected', () => {
      console.log('connected')
    })
  })

  await waitForConsoleLog
})

test('iframe should call function to parent', async ({page}) => {
  const waitForConsoleLog = new Promise<void>((resolve) => {
    page.on('console', (msg) => {
      const text = msg.text()
      if (text.includes('called parentPageFn from iframe')) {
        resolve()
      }
    })
  })

  const pageCode = `
    const parentPage = testFramecomms.parent({
      id: 'my-parent',
      options: {origin: '*'},
      available: {
        parentPageFn: (params) => {
          console.log('called parentPageFn from iframe')
        },
      },
    })

    const myFrame = parentPage.createIframe({
      src: '',
    })

    myFrame.render('#child')
  `

  const frames = await setUp({page, pageCode})
  const frame = frames[0]

  // Inject custom test code into the iframe, that uses your lib
  await frame.evaluate(() => {
    if (!window.testFramecomms) {
      return
    }

    const insideIframe = window.testFramecomms.connectTo({
      id: 'my-parent',
    })

    insideIframe.on('@FRAMECOMMS/onConnected', () => {
      insideIframe.call('parentPageFn', 'data')
    })
  })

  await waitForConsoleLog
})

test('parent should call function to iframe', async ({page}) => {
  const waitForConsoleLog = new Promise<void>((resolve) => {
    page.on('console', (msg) => {
      const text = msg.text()
      if (text === 'called iframeFn') {
        resolve()
      }
    })
  })
  const pageCode = `
    const parentPage = testFramecomms.parent({
      id: 'my-parent',
      options: {origin: '*'},
      available: {}
    })

    const myFrame = parentPage.createIframe({
      src: '',
    })

    myFrame.render('#child')

    parentPage.call('iframeFn', 'a')
  `

  const frames = await setUp({page, pageCode})
  const frame = frames[0]

  await frame.evaluate(() => {
    if (!window.testFramecomms) {
      return
    }

    const insideIframe = window.testFramecomms.connectTo({
      id: 'my-parent',
      available: {
        iframeFn: () => {
          console.log('called iframeFn')
        },
      },
    })
  })

  await waitForConsoleLog
})

test('iframe should access parent props with get function', async ({page}) => {
  const waitForConsoleLog = new Promise<void>((resolve) => {
    page.on('console', (msg) => {
      const text = msg.text()

      if (text === 'propery value') {
        resolve()
      }
    })
  })
  const pageCode = `
    const parentPage = testFramecomms.parent({
      id: '1',
      options: {origin: '*'},
      available: {
        myPropery: 'propery value'
      }
    })

    const myFrame = parentPage.createIframe({
      src: '',
    })

    myFrame.render('#child')
  `

  const frames = await setUp({page, pageCode})
  const frame = frames[0]

  await frame.evaluate(() => {
    if (!window.testFramecomms) {
      return
    }

    const insideIframe = window.testFramecomms.connectTo({
      id: '1',
      available: {},
    })

    insideIframe.on('@FRAMECOMMS/onConnected', () => {
      console.log(insideIframe.get('myPropery'))
    })
  })

  await waitForConsoleLog
})

test('iframe should call function to parent and receive return value', async ({
  page,
}) => {
  const waitForConsoleLog = new Promise<void>((resolve) => {
    page.on('console', (msg) => {
      const text = msg.text()
      if (text === 'called parentPageFn from iframe') {
        resolve()
      }
    })
  })

  const pageCode = `
    const parentPage = testFramecomms.parent({
      id: 'my-parent',
      options: {origin: '*'},
      available: {
        parentPageFn: (params) => {
          return 'called parentPageFn from iframe'
        },
      },
    })

    const myFrame = parentPage.createIframe({
      src: '',
    })

    myFrame.render('#child')
  `

  const frames = await setUp({page, pageCode})
  const frame = frames[0]

  // Inject custom test code into the iframe, that uses your lib
  await frame.evaluate(() => {
    if (!window.testFramecomms) {
      return
    }

    const insideIframe = window.testFramecomms.connectTo({
      id: 'my-parent',
    })

    insideIframe.on('@FRAMECOMMS/onConnected', async () => {
      const result = await insideIframe.call('parentPageFn', 'data')
      console.log(result)
    })
  })

  await waitForConsoleLog
})

test('parent should call function to iframe and receive return value', async ({
  page,
}) => {
  const waitForConsoleLog = new Promise<void>((resolve) => {
    page.on('console', (msg) => {
      const text = msg.text()

      if (text === 'called iframeFn') {
        resolve()
      }
    })
  })
  const pageCode = `
    const parentPage = testFramecomms.parent({
      id: '1',
      options: {origin: '*'},
    })

    const myFrame = parentPage.createIframe({
      src: '',
    })

    myFrame.render('#child')

    setTimeout(async () => {
      const result = await parentPage.call('iframeFn', 'a')
      console.log(result)
    }, 100)
  `

  const frames = await setUp({page, pageCode})
  const frame = frames[0]

  await frame.evaluate(() => {
    if (!window.testFramecomms) {
      return
    }

    const insideIframe = window.testFramecomms.connectTo({
      id: '1',
      available: {
        iframeFn: () => {
          return 'called iframeFn'
        },
      },
    })
  })

  await waitForConsoleLog
})

test('iframe should subscribe to on and parent can emit', async ({page}) => {
  const waitForConsoleLog = new Promise<void>((resolve) => {
    page.on('console', (msg) => {
      const text = msg.text()

      if (text === 'param from emit') {
        resolve()
      }
    })
  })
  const pageCode = `
    const parentPage = testFramecomms.parent({
      id: '1',
      options: {origin: '*'},
    })

    const myFrame = parentPage.createIframe({
      src: '',
    })

    myFrame.render('#child')

    setTimeout(async () => {
      await parentPage.emit('subscriber', 'param from emit')
    }, 100)
  `

  const frames = await setUp({page, pageCode})
  const frame = frames[0]

  await frame.evaluate(() => {
    if (!window.testFramecomms) {
      return
    }

    const insideIframe = window.testFramecomms.connectTo({
      id: '1',
      available: {},
    })

    insideIframe.on('subscriber', (param: any) => {
      console.log(param)
    })
  })

  await waitForConsoleLog
})

test('iframe should queue calls parent if its not connected', async ({
  page,
}) => {
  const waitForConsoleLog = new Promise<void>((resolve) => {
    page.on('console', (msg) => {
      const text = msg.text()

      if (text === 'called parent') {
        resolve()
      }
    })
  })

  const pageCode = `
    const parentPage = testFramecomms.parent({
      id: 'my-parent',
      options: {origin: '*'},
      available: {
        parentPageFn: (params) => {
          console.log('called parent')
        },
      },
    })

    const myFrame = parentPage.createIframe({
      src: '',
    })

    myFrame.render('#child')
  `

  const frames = await setUp({page, pageCode})
  const frame = frames[0]

  // Inject custom test code into the iframe, that uses your lib
  await frame.evaluate(() => {
    if (!window.testFramecomms) {
      return
    }

    const insideIframe = window.testFramecomms.connectTo({
      id: 'my-parent',
    })

    insideIframe.call('parentPageFn', 'data')
    insideIframe.on('@FRAMECOMMS/onConnected', async () => {
      console.log('connected')
    })
  })

  await waitForConsoleLog
})

test('parent should be able to subscribe to events', async ({page}) => {
  const waitForConsoleLog = new Promise<void>((resolve) => {
    page.on('console', (msg) => {
      const text = msg.text()
      if (text === 'custom-event-value') {
        resolve()
      }
    })
  })

  const pageCode = `
    const parentPage = testFramecomms.parent({
      id: 'my-parent',
      options: {origin: '*'},
      available: {},
    })

    const myFrame = parentPage.createIframe({
      src: '',
    })

    myFrame.render('#child')

    parentPage.on('custom-event', (value) => {
      console.log(value)
    })
  `

  const frames = await setUp({page, pageCode})
  const frame = frames[0]

  // Inject custom test code into the iframe, that uses your lib
  await frame.evaluate(() => {
    if (!window.testFramecomms) {
      return
    }

    const insideIframe = window.testFramecomms.connectTo({
      id: 'my-parent',
    })

    insideIframe.emit('custom-event', 'custom-event-value')
  })

  await waitForConsoleLog
})

test('parent should call function on iframe, iframe registers after creation', async ({
  page,
}) => {
  const waitForConsoleLog = new Promise<void>((resolve) => {
    page.on('console', (msg) => {
      const text = msg.text()
      if (text === 'called iframeFn') {
        resolve()
      }
    })
  })
  const pageCode = `
    const parentPage = testFramecomms.parent({
      id: '1',
      options: {origin: '*'},
    })

    const myFrame = parentPage.createIframe({
      src: '',
    })

    myFrame.render('#child')

    setTimeout(async () => {
      const result = await parentPage.call('iframeFn', 'a')
      console.log(result)
    }, 100)
  `

  const frames = await setUp({page, pageCode})
  const frame = frames[0]

  await frame.evaluate(() => {
    if (!window.testFramecomms) {
      return
    }

    const insideIframe = window.testFramecomms.connectTo({
      id: '1',
      available: {},
    })

    insideIframe.addAvailable({
      iframeFn: () => {
        return 'called iframeFn'
      },
    })
  })

  await waitForConsoleLog
})

test('iframe should get parent emit for new subscriber', async ({page}) => {
  const waitForConsoleLog = new Promise<void>((resolve) => {
    page.on('console', (msg) => {
      const text = msg.text()
      if (text === 'iframe-loaded') {
        resolve()
      }
    })
  })
  const pageCode = `
    const parentPage = testFramecomms.parent({
      id: '1',
      options: {origin: '*'},
    })

    const myFrame = parentPage.createIframe({
      src: '',
    })

    myFrame.render('#child')
  `

  const frames = await setUp({page, pageCode})
  const frame = frames[0]

  await frame.evaluate(() => {
    if (!window.testFramecomms) {
      return
    }

    const insideIframe = window.testFramecomms.connectTo({
      id: '1',
      available: {},
    })

    insideIframe.on('@FRAMECOMMS/onSubscriber', () => {
      console.log('iframe-loaded')
    })
  })

  await waitForConsoleLog
})

test('parent should be able to create multible iframes', async ({page}) => {
  const pageCode = `
    const parentPage = testFramecomms.parent({
      id: '1',
      options: {origin: '*'},
    })

    const myFrame = parentPage.createIframe({
      src: '',
    })

    const myFrame2 = parentPage.createIframe({
      src: '2',
    })

    myFrame.render('#child')
    myFrame2.render('#child2')
  `

  await setUp({page, pageCode})
  const iframes = page.locator('iframe')
  const iframeCount = await iframes.count()

  if (iframeCount !== 2) {
    throw new Error('not correct nr of iframes')
  }
})

test('iframe should be able to call fn of another iframe', async ({page}) => {
  const waitForConsoleLog = new Promise<void>((resolve) => {
    page.on('console', (msg) => {
      const text = msg.text()
      if (text === 'called frame1Fn') {
        resolve()
      }
    })
  })
  const pageCode = `
    const parentPage = testFramecomms.parent({
      id: '1',
      options: {origin: '*'},
      available: {},
    })

    const myFrame = parentPage.createIframe({
      src: '',
    })

    const myFrame2 = parentPage.createIframe({
      src: '2',
    })

    myFrame.render('#child')
    myFrame2.render('#child2')
  `

  const frames = await setUp({page, pageCode})
  const frame1 = frames[0]
  const frame2 = frames[0]

  await frame1.evaluate(() => {
    if (!window.testFramecomms) {
      return
    }

    window.testFramecomms.connectTo({
      id: '1',
      available: {
        frame1Fn: () => {
          console.log('called frame1Fn')
        },
      },
    })
  })

  await frame2.evaluate(() => {
    if (!window.testFramecomms) {
      return
    }

    const insideIframe = window.testFramecomms.connectTo({
      id: '1',
      available: {},
    })

    // calling function in frame1 from frame2 by passing call to parent then to suscriber
    insideIframe.call('frame1Fn')
  })

  await waitForConsoleLog
})

test('iframe should be able to call fn of another iframe and get response', async ({
  page,
}) => {
  const waitForConsoleLog = new Promise<void>((resolve) => {
    page.on('console', (msg) => {
      const text = msg.text()
      console.log(text)
      if (text === 'from iframe 1') {
        resolve()
      }
    })
  })
  const pageCode = `
    const parentPage = testFramecomms.parent({
      id: '1',
      options: {origin: '*'},
      available: {},
    })

    const myFrame = parentPage.createIframe({
      src: '',
    })

    const myFrame2 = parentPage.createIframe({
      src: '2',
    })

    myFrame.render('#child')
    myFrame2.render('#child2')
  `

  const frames = await setUp({page, pageCode})
  const frame1 = frames[0]
  const frame2 = frames[0]

  await frame1.evaluate(() => {
    if (!window.testFramecomms) {
      return
    }

    window.testFramecomms.connectTo({
      id: '1',
      available: {
        frame1Fn: () => {
          return 'from iframe 1'
        },
      },
    })
  })

  await frame2.evaluate(() => {
    if (!window.testFramecomms) {
      return
    }

    const insideIframe = window.testFramecomms.connectTo({
      id: '1',
      available: {},
    })

    // calling function in frame1 from frame2 by passing call to parent then to suscriber
    insideIframe.call('frame1Fn').then((response: any) => {
      console.log(response)
    })
  })

  await waitForConsoleLog
})

test('iframe should subscribe once and parent can emit multible', async ({
  page,
}) => {
  const waitForConsoleLog = new Promise<void>((resolve, reject) => {
    let nr = 0
    page.on('console', (msg) => {
      const text = msg.text()

      if (text === 'param from emit') {
        nr += 1
        setTimeout(() => {
          if (nr === 1) {
            resolve()
          } else {
            reject(new Error('emitted multible times'))
          }
        }, 400)
      }
    })
  })
  const pageCode = `
    const parentPage = testFramecomms.parent({
      id: '1',
      options: {origin: '*'},
    })

    const myFrame = parentPage.createIframe({
      src: '',
    })

    myFrame.render('#child')

    setTimeout(async () => {
      await parentPage.emit('subscriber', 'param from emit')
    }, 100)

    setTimeout(async () => {
      await parentPage.emit('subscriber', 'param from emit')
    }, 130)
  `

  const frames = await setUp({page, pageCode})
  const frame = frames[0]

  await frame.evaluate(() => {
    if (!window.testFramecomms) {
      return
    }

    const insideIframe = window.testFramecomms.connectTo({
      id: '1',
      available: {},
    })

    insideIframe.once('subscriber', (param: any) => {
      console.log(param)
    })
  })

  await waitForConsoleLog
})
