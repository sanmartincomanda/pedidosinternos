import { Capacitor, registerPlugin } from "@capacitor/core";

const NativePdfPrinter = registerPlugin("NativePdfPrinter");

function printPdfInBrowser({ base64, fileName }) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const objectUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const printWindow = window.open(objectUrl, "_blank");
  if (!printWindow) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("El navegador bloqueo la ventana de impresion.");
  }

  let dialogOpened = false;
  const openPrintDialog = () => {
    if (dialogOpened) return;
    dialogOpened = true;
    printWindow.focus();
    printWindow.print();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  };
  printWindow.addEventListener("load", openPrintDialog, { once: true });
  window.setTimeout(openPrintDialog, 1_200);
  return { ok: true, platform: "web", fileName };
}

export async function printPdfDocument({ base64, fileName }) {
  if (!base64) throw new Error("No se pudo preparar el PDF para imprimir.");

  if (window.desktopAPI?.printPdf) {
    const result = await window.desktopAPI.printPdf({ base64, fileName });
    if (result?.ok === false && !result?.cancelled) {
      throw new Error(result.error || "Windows no pudo abrir la impresion.");
    }
    return result;
  }

  if (Capacitor.getPlatform() === "android") {
    return NativePdfPrinter.print({ base64, fileName });
  }

  return printPdfInBrowser({ base64, fileName });
}
