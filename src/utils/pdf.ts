/**
 * Utility to extract text from a PDF file using pdfjs-dist from CDN.
 */

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

let pdfjsPromise: Promise<any> | null = null;

export const loadPdfJs = (): Promise<any> => {
  if (pdfjsPromise) return pdfjsPromise;

  pdfjsPromise = new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      resolve(window.pdfjsLib);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      } else {
        reject(new Error('PDF.js loaded but pdfjsLib is not defined.'));
      }
    };
    script.onerror = () => {
      pdfjsPromise = null; // Reset to allow retry
      reject(new Error('Failed to load PDF.js from CDN.'));
    };
    document.head.appendChild(script);
  });

  return pdfjsPromise;
};

/**
 * Extracts text from a PDF ArrayBuffer.
 * Throws "PASSWORD_PROTECTED" if the file is password-protected.
 */
export const extractTextFromPdf = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  const pdfjs = await loadPdfJs();
  
  try {
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    const numPages = pdf.numPages;
    
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText.trim();
  } catch (error: any) {
    console.error('Error during PDF extraction:', error);
    // Determine if it is password protected
    if (
      error?.name === 'PasswordException' ||
      error?.code === 1 ||
      error?.message?.toLowerCase().includes('password') ||
      error?.message?.toLowerCase().includes('decrypt')
    ) {
      throw new Error('PASSWORD_PROTECTED');
    }
    throw error;
  }
};
