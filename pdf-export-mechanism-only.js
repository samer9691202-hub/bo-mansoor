/* PDF export / print mechanism only. Reuses an already-rendered document unchanged. */
function waitForImages(root) {
  const images = Array.from(root.querySelectorAll('img'));
  return Promise.all(images.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => resolve();
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
  }));
}

async function waitForPrintAssets(doc, root) {
  if (doc.fonts && doc.fonts.ready) {
    try { await doc.fonts.ready; } catch (_) { /* continue if a font fails */ }
  }
  await waitForImages(root);
  await new Promise((resolve) => {
    const view = doc.defaultView;
    if (!view || !view.requestAnimationFrame) return resolve();
    view.requestAnimationFrame(() => view.requestAnimationFrame(resolve));
  });
}

function copyCurrentPageStyles(sourceDocument, targetDocument) {
  sourceDocument.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    targetDocument.head.appendChild(node.cloneNode(true));
  });
}

async function exportExistingDocumentToPDF(source, filename = 'document', existingWindow = null) {
  const sourceDocument = source && source.ownerDocument ? source.ownerDocument : document;
  const element = typeof source === 'string'
    ? sourceDocument.querySelector(source)
    : source;
  if (!element || element.nodeType !== 1) {
    throw new Error('PDF export: existing document element was not found.');
  }
  // Reuse the window already opened by the document action to avoid a second
  // popup being blocked after asynchronous pagination and image loading.
  const printWindow = existingWindow || window.open('', '_blank');
  if (!printWindow) throw new Error('PDF export: allow pop-ups, then try again.');
  const printDocument = printWindow.document;
  try {
    if (!existingWindow) {
      printDocument.open();
      printDocument.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title></title></head><body></body></html>');
      printDocument.close();
      printDocument.title = filename;
      copyCurrentPageStyles(sourceDocument, printDocument);
      printDocument.body.appendChild(element.cloneNode(true));
    }
    await waitForPrintAssets(printDocument, existingWindow ? element : printDocument.body);
    printWindow.focus();
    printWindow.print();
  } catch (error) {
    if (!existingWindow) printWindow.close();
    throw error;
  }
}

function printExistingDocument(source, title = 'document') {
  return exportExistingDocumentToPDF(source, title);
}
window.exportExistingDocumentToPDF = exportExistingDocumentToPDF;
window.printExistingDocument = printExistingDocument;
