const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  isDesktop: true,
  getRuntime: () => ipcRenderer.invoke("desktop:get-runtime"),
  notify: (payload) => ipcRenderer.send("desktop:notify", payload),
  printPdf: (payload) => ipcRenderer.invoke("desktop:print-pdf", payload),
  show: (view) => ipcRenderer.send("desktop:show", view),
  onNavigate: (callback) => {
    const listener = (_event, destination) => callback(destination);
    ipcRenderer.on("desktop:navigate", listener);
    return () => ipcRenderer.removeListener("desktop:navigate", listener);
  },
});
