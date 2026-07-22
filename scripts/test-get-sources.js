const { app, desktopCapturer } = require('electron');
app.whenReady().then(async () => {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
    console.log("SUCCESS:", sources.length, "sources found");
    process.exit(0);
  } catch(e) {
    console.error("ERROR:", e);
    process.exit(1);
  }
});
