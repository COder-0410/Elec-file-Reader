const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs').promises

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    backgroundColor: '#1e1e1e', // Dark background color
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    },
    // Optional: Remove the default menu
    autoHideMenuBar: true,
  })

  // Load the index.html file
  win.loadFile('index.html')
  
  // Optional: Open DevTools automatically
  win.webContents.openDevTools()
}

// Handle IPC from renderer
ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  return canceled ? null : filePaths[0]
})

// Read directory contents
ipcMain.handle('fs:readDirectory', async (event, dirPath) => {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true })
    
    // Sort items: directories first, then files
    const sortedItems = items.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1
      if (!a.isDirectory() && b.isDirectory()) return 1
      return a.name.localeCompare(b.name)
    })
    
    // Map to a more useful structure with full paths
    return sortedItems.map(item => ({
      name: item.name,
      path: path.join(dirPath, item.name),
      isDirectory: item.isDirectory(),
      extension: path.extname(item.name).slice(1)
    }))
  } catch (err) {
    console.error('Error reading directory:', err)
    throw err
  }
})

// Check if path is a directory
ipcMain.handle('fs:isDirectory', async (event, filePath) => {
  try {
    const stats = await fs.stat(filePath)
    return stats.isDirectory()
  } catch (err) {
    console.error('Error checking if directory:', err)
    throw err
  }
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})