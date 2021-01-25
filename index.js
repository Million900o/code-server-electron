const { app, BrowserWindow, ipcMain, screen } = require('electron')
const DiscordRPC = require('discord-rpc')
const path = require('path')

// The join char, apple is strange
const defaultChar = process.platform === 'darwin' ? '—' : '-'

// define "global" variables
let loading
let VSCwin
let page

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
const getTitle = () => VSCwin?.title.split(` ${defaultChar}`)[0]

rpc.on('ready', () => {
  // Fancy logs
  console.log('DEBUG | RPC Started')
  console.log(` LOG  | Logged in as ${rpc.user.username}`)

  // Get the before one.
  let before = getTitle()

  // Every 100ms, check if the file changed
  setInterval(async () => {
    // If no window and isn't already loading, or the title is "code-server" set activity to loading
    if ((!VSCwin && !loading) || getTitle().split(' ')[0] === 'code-server') {
      loading = true
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
  // Login to the RPC
  rpc.login({ clientId: '802641162115612682' })

  // Create the window to ask for URL, show it when ready
  const win = new BrowserWindow({ width: 700, height: 100, show: false, darkTheme: true, webPreferences: { nodeIntegration: true, contextIsolation: false } })
  win.loadURL('file://' + path.join(__dirname, 'static/page.html'))
  win.once('ready-to-show', () => { win.show() })

  // When the main IPC gets "url:save" event
  ipcMain.on('url:save', async (e, url) => {
    // Add a / to the end of the URL if it doesn't have one
    page = url.endsWith('/') ? url : url + '/'

    // close the indow
    win.close()

    // Get screen size
    const { width, height } = screen.getPrimaryDisplay().workAreaSize

    // Create the code-server window with the correct size, then show it
    VSCwin = new BrowserWindow({ width: width, height: height, show: false, darkTheme: true, webPreferences: { contextIsolation: false } })
    VSCwin.loadURL(page)
    VSCwin.once('ready-to-show', () => { VSCwin.show() })

    // When it is closed, quit the app
    VSCwin.on('close', (e) => {
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
