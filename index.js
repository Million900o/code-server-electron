const { app, BrowserWindow, ipcMain, screen, Notification } = require('electron')
const DiscordRPC = require('discord-rpc')
const path = require('path')

// define "global" variables
let loading
let VSCwin
let page
let loginWin

// Create the RPC
const rpc = new DiscordRPC.Client({ transport: 'ipc' })

// The function to change status
const setActivity = async (text, date = new Date()) => {
  // Log the status update
  console.log('DEBUG | status updated')

  // Set the status to "text" at "date"
  rpc.setActivity({
    details: text,
    largeImageKey: 'vscode',
    largeImageText: 'Visual Studio Code',
    startTimestamp: date
  })
}

// Function to get the title of the page
const getTitle = () => VSCwin ? VSCwin.title.split(/ —| -/g)[0].toString().replace(/●/g, '') : 'code-server'

rpc.on('ready', () => {
  // Fancy logs
  console.log('DEBUG | RPC Started')
  console.log(` LOG  | Logged in as ${rpc.user.username}`)

  // Get the before one.
  let before = getTitle()

  // Every 100ms, check if the file changed
  setInterval(async () => {
    if (!VSCwin) return
    // Check if its logging in or still starting
    if (getTitle()?.split(' ')[0] === 'code-server') {
      // If its already done this, return
      if (loading) return

      // Make it so it knows if its done it
      loading = true

      // Set before to the title
      before = getTitle()

      // Set the status to logging in
      await setActivity('Logging in', new Date())
      return
    }

    if (!VSCwin) {
      // If it is already loading, return
      if (loading) return

      // Make it so it is loading
      loading = true

      // Set before to the title
      before = getTitle()

      // Set the activity to loading
      await setActivity('Loading...', new Date())
      return
    }

    // If the title changed
    if (getTitle() !== before) {
      // Reset loading and before
      loading = false
      before = getTitle()

      // Set the activity to the file
      await setActivity(`File: ${getTitle()}`)
    }
  }, 100)
})

app.whenReady().then(async () => {
  // Get screen size
  let { width, height } = screen.getPrimaryDisplay().workAreaSize;
  winWidth = parseInt(0.37 * width)
  winHeight = parseInt(0.12 * height)

  // Create the window to ask for URL, show it when ready
  const win = new BrowserWindow({ width: winWidth, height: winHeight, show: false, darkTheme: true, webPreferences: { nodeIntegration: true, contextIsolation: false } })
  win.setMenu(null)
  win.loadURL('file://' + path.join(__dirname, 'static/page.html'))
  win.once('ready-to-show', () => { win.show() })

  // When the main IPC gets "url:save" event
  ipcMain.on('url:save', async (e, url) => {
    // Add a / to the end of the URL if it doesn't have one
    page = url.endsWith('/') ? url : url + '/'

    // close the indow
    win.close()

    // Create the code-server window with the correct size, then show it
    VSCwin = new BrowserWindow({ width: width, height: height, show: false, darkTheme: true, webPreferences: { contextIsolation: false } })
    VSCwin.setMenu(null)
    VSCwin.loadURL(page)
    VSCwin.once('ready-to-show', () => {
      // Login to the RPC
      rpc.login({ clientId: '802641162115612682' })
      VSCwin.show()
    })

    // When it is closed, quit the app
    VSCwin.on('close', (e) => {
      VSCwin = null
      app.quit()
    })
  })
})

// When the windows close, stop the app from quiting
// We need this because the URL window will close
// BEFORE the VSC window will open
app.on('window-all-closed', async (e) => {
  e.preventDefault()
})

// When it asks for basic-auth
app.on('login', (event, webContents, request, authInfo, callback) => {
  // Get screen size
  let { width, height } = screen.getPrimaryDisplay().workAreaSize
  width = parseInt(0.27 * width)
  height = parseInt(0.18 * height)

  // Stop some random shit from happening
  event.preventDefault()


  // Create the window to ask for username and password, show it when ready
  loginWin = new BrowserWindow({ width: width, height: height, show: false, darkTheme: true, webPreferences: { nodeIntegration: true, contextIsolation: false } })
  loginWin.setMenu(null)
  loginWin.loadURL('file://' + path.join(__dirname, 'static/login.html'))
  loginWin.once('ready-to-show', () => { loginWin.show() })

  loginWin.on('close', () => {
    loginWin = null
  })

  // When the ipcMain gets login event
  ipcMain.once('login', (e, details) => {
    // Close the window and set it to null
    if (loginWin) {
      loginWin.close()
      loginWin = null
    }

    // Call the callback
    callback(details.username, details.password)
  })
})
