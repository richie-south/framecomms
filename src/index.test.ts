import {test} from '@playwright/test'
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

async function setUp({page, pageCode}: any) {
  page.on('pageerror', (err) => {
    console.error('❌ Page error:', err.message)
  })

  page.on('crash', () => {
    console.error('🔥 Page crashed!')
  })

  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <body>
<div id="child"></div>
        <script>
          ${libCode}
          ${pageCode}

        </script>
      </body>
    </html>
  `)

  const iframeHandle = await page.$('iframe')

  // Use srcdoc to define an initial HTML with a script placeholder
  await iframeHandle!.evaluate((el) => {
    el.setAttribute(
      'srcdoc',
      '<html><body><div id="status"></div></body></html>',
    )
  })

  // Wait for iframe to load
  const frame = await (await iframeHandle!.contentFrame())!

  // Now inject your built libCode as a <script> tag in the iframe
  await frame.evaluate((code: string) => {
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.textContent = code
    document.body.appendChild(script)
  }, libCode)

  return frame
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
    const parentPage = testFramecomms.createIframe({
      id: '1',
      src: '',
      options: {origin: '*'}
    })

    parentPage.render('#child')
  `

  const frame = await setUp({page, pageCode})

  await frame.evaluate(() => {
    if (!window.testFramecomms) {
      return
    }

    const insideIframe = window.testFramecomms.connectTo({
      id: '1',
    })

    insideIframe.on('@FRAMECOMMS/connected', () => {
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
    const parentPage = testFramecomms.createIframe({
      id: 'my-frame',
      src: '',
      options: {origin: '*'},
      available: {
        parentPageFn: (params) => {
          console.log('called parentPageFn from iframe')
        },
      },
    })

    parentPage.render('#child')
  `

  const frame = await setUp({page, pageCode})

  // Inject custom test code into the iframe, that uses your lib
  await frame.evaluate(() => {
    if (!window.testFramecomms) {
      return
    }

    const insideIframe = window.testFramecomms.connectTo({
      id: 'my-frame',
    })

    insideIframe.on('@FRAMECOMMS/connected', () => {
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
    const parentPage = testFramecomms.createIframe({
      id: '1',
      src: '',
      options: {origin: '*'},
    })

    parentPage.render('#child')

    setTimeout(() => {
      parentPage.call('iframeFn', 'a')
    }, 100)
  `

  const frame = await setUp({page, pageCode})

  await frame.evaluate(() => {
    if (!window.testFramecomms) {
      return
    }

    const insideIframe = window.testFramecomms.connectTo({
      id: '1',
      available: {
        iframeFn: () => {
          console.log('called iframeFn')
        },
      },
    })
  })

  await waitForConsoleLog
})

test('iframe should access parent props on window.framecommsProps', async ({
  page,
}) => {
  const waitForConsoleLog = new Promise<void>((resolve) => {
    page.on('console', (msg) => {
      const text = msg.text()

      if (text === 'propery value') {
        resolve()
      }
    })
  })
  const pageCode = `
    const parentPage = testFramecomms.createIframe({
      id: '1',
      src: '',
      options: {origin: '*'},
      available: {
        myPropery: 'propery value'
      }
    })

    parentPage.render('#child')
  `

  const frame = await setUp({page, pageCode})

  await frame.evaluate(() => {
    if (!window.testFramecomms) {
      return
    }

    const insideIframe = window.testFramecomms.connectTo({
      id: '1',
      available: {},
    })

    insideIframe.on('@FRAMECOMMS/connected', () => {
      console.log(window.framecommsProps.myPropery)
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
    const parentPage = testFramecomms.createIframe({
      id: 'my-frame',
      src: '',
      options: {origin: '*'},
      available: {
        parentPageFn: (params) => {
          return 'called parentPageFn from iframe'
        },
      },
    })

    parentPage.render('#child')
  `

  const frame = await setUp({page, pageCode})

  // Inject custom test code into the iframe, that uses your lib
  await frame.evaluate(() => {
    if (!window.testFramecomms) {
      return
    }

    const insideIframe = window.testFramecomms.connectTo({
      id: 'my-frame',
    })

    insideIframe.on('@FRAMECOMMS/connected', async () => {
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
    const parentPage = testFramecomms.createIframe({
      id: '1',
      src: '',
      options: {origin: '*'},
    })

    parentPage.render('#child')

    setTimeout(async () => {
      const result = await parentPage.call('iframeFn', 'a')
      console.log(result)
    }, 100)
  `

  const frame = await setUp({page, pageCode})

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
    const parentPage = testFramecomms.createIframe({
      id: '1',
      src: '',
      options: {origin: '*'},
    })

    parentPage.render('#child')

    setTimeout(async () => {
      await parentPage.emit('subscriber', 'param from emit')
    }, 100)
  `

  const frame = await setUp({page, pageCode})

  await frame.evaluate(() => {
    if (!window.testFramecomms) {
      return
    }

    const insideIframe = window.testFramecomms.connectTo({
      id: '1',
      available: {},
    })

    insideIframe.on('subscriber', (param) => {
      console.log(param)
    })
  })

  await waitForConsoleLog
})
