const { app, BrowserWindow, desktopCapturer, ipcMain } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(__dirname + '/test-screenshare.html');
  
  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(`
      document.getElementById("b").click();
      console.log("Clicked share button");
    `);
  });

  const tab = new BrowserWindow({ show: false });
  tab.loadURL('https://example.com');

  win.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
    console.log("Got request");
    setTimeout(() => {
      console.log("Sending callback with tab mainFrame");
      callback({ video: tab.webContents.mainFrame, audio: tab.webContents.mainFrame });
    }, 1000);
  });
  
  ipcMain.on('success', () => {
    console.log("SUCCESS!");
    process.exit(0);
  });
  ipcMain.on('fail', (e, err) => {
    console.error("FAILED!", err);
    process.exit(1);
  });
});
