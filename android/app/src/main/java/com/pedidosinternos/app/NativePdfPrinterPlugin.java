package com.pedidosinternos.app;

import android.content.Context;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;

@CapacitorPlugin(name = "NativePdfPrinter")
public class NativePdfPrinterPlugin extends Plugin {
    private static final int MAX_PDF_BYTES = 20 * 1024 * 1024;

    @PluginMethod
    public void print(PluginCall call) {
        String encodedPdf = call.getString("base64", "").replaceAll("\\s+", "");
        String requestedName = call.getString("fileName", "Requisa.pdf");

        try {
            byte[] pdfBytes = Base64.decode(encodedPdf, Base64.DEFAULT);
            if (pdfBytes.length < 5 || pdfBytes.length > MAX_PDF_BYTES ||
                    pdfBytes[0] != '%' || pdfBytes[1] != 'P' || pdfBytes[2] != 'D' || pdfBytes[3] != 'F') {
                call.reject("El documento recibido no es un PDF valido.");
                return;
            }

            File printDirectory = new File(getContext().getCacheDir(), "requisa-print");
            if (!printDirectory.exists() && !printDirectory.mkdirs()) {
                call.reject("No se pudo preparar el directorio de impresion.");
                return;
            }

            String normalizedName = requestedName.replaceAll("[^a-zA-Z0-9._-]+", "-");
            final String safeName = normalizedName.toLowerCase().endsWith(".pdf")
                    ? normalizedName
                    : normalizedName + ".pdf";
            File pdfFile = new File(printDirectory, System.currentTimeMillis() + "-" + safeName);
            try (FileOutputStream output = new FileOutputStream(pdfFile)) {
                output.write(pdfBytes);
            }

            getActivity().runOnUiThread(() -> openPrintDialog(call, pdfFile, safeName));
        } catch (IllegalArgumentException | IOException error) {
            call.reject("No se pudo preparar la requisa para imprimir.", error);
        }
    }

    private void openPrintDialog(PluginCall call, File pdfFile, String jobName) {
        PrintManager printManager = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
        if (printManager == null) {
            pdfFile.delete();
            call.reject("Android no tiene un servicio de impresion disponible.");
            return;
        }

        PrintAttributes attributes = new PrintAttributes.Builder()
                .setMediaSize(PrintAttributes.MediaSize.NA_LETTER)
                .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                .build();
        printManager.print(jobName, new PdfDocumentAdapter(pdfFile), attributes);

        JSObject result = new JSObject();
        result.put("ok", true);
        result.put("platform", "android");
        call.resolve(result);
    }

    private static class PdfDocumentAdapter extends PrintDocumentAdapter {
        private final File pdfFile;

        PdfDocumentAdapter(File pdfFile) {
            this.pdfFile = pdfFile;
        }

        @Override
        public void onLayout(
                PrintAttributes oldAttributes,
                PrintAttributes newAttributes,
                CancellationSignal cancellationSignal,
                LayoutResultCallback callback,
                android.os.Bundle extras
        ) {
            if (cancellationSignal.isCanceled()) {
                callback.onLayoutCancelled();
                return;
            }

            PrintDocumentInfo info = new PrintDocumentInfo.Builder(pdfFile.getName())
                    .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                    .setPageCount(PrintDocumentInfo.PAGE_COUNT_UNKNOWN)
                    .build();
            callback.onLayoutFinished(info, true);
        }

        @Override
        public void onWrite(
                PageRange[] pages,
                ParcelFileDescriptor destination,
                CancellationSignal cancellationSignal,
                WriteResultCallback callback
        ) {
            try (FileInputStream input = new FileInputStream(pdfFile);
                 FileOutputStream output = new FileOutputStream(destination.getFileDescriptor())) {
                byte[] buffer = new byte[8192];
                int length;
                while ((length = input.read(buffer)) >= 0) {
                    if (cancellationSignal.isCanceled()) {
                        callback.onWriteCancelled();
                        return;
                    }
                    output.write(buffer, 0, length);
                }
                callback.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES});
            } catch (IOException error) {
                callback.onWriteFailed(error.getMessage());
            }
        }

        @Override
        public void onFinish() {
            pdfFile.delete();
        }
    }
}
