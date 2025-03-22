const express = require("express");
const router = express.Router();
const multer = require("multer");
const { PdfViewer } = require("@syncfusion/ej2-pdfviewer");
const Document = require("../models/Document");

const pdfviewer = new PdfViewer();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// // In pdfviewer.js, add this at the top
// router.get('/', (req, res) => {
//     res.send('PDF Viewer API endpoint is working');
//   });

// Handle Load document
// In pdfviewer.js, update your Load handler

// In pdfviewer.js
router.options("/Load", (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', 86400); // Cache preflight for 24 hours
    res.sendStatus(204); // No content, just acknowledge
  });
  
router.post("/Load", upload.any(), async (req, res) => {
  try {
    console.log("Load request received:", req.body);
    // Assuming the document ID is sent in the request body
    const { document: documentId } = req.body; // Adjust based on how you send the ID

    // Fetch the document from the database using the ID
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    const responseData = {
        fileName: `document-${documentId}.pdf`,
        pdfData: document.content // Direct base64 string
      };
      console.log("Sending response:", {
        fileName: responseData.fileName,
        pdfDataLength: responseData.pdfData.length
      });
  
      res.json(responseData);
    }
      
      catch (error) {
    console.error("Load error:", error);
    res.status(500).send(error.message);
  }
});

// Handle Download document
router.post("/Download", async (req, res) => {
  try {
    await pdfviewer.download(req, res);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Handle PDF pages rendering
router.post("/RenderPdfPages", async (req, res) => {
  try {
    await pdfviewer.renderPages(req, res);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Handle Annotations
router.post("/RenderAnnotationComments", async (req, res) => {
  try {
    await pdfviewer.renderAnnotationComments(req, res);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

module.exports = router;
