export function downloadGeneratedPage(steps, text) {
   if (!Array.isArray(steps)) {
      console.error("Error: steps must be an array.");
      return;
   }

   // Encode steps and text to ensure proper JSON formatting
   const stepsJSON = encodeURIComponent(JSON.stringify(steps));
   const textEncoded = encodeURIComponent(text);

   // Base URL for JSDelivr CDN (replace with your username and repo)
   const cdnBaseURL =
      "https://cdn.jsdelivr.net/gh/AnastasisDimou/ProcedureGenerator/";

   // List of JavaScript files (hosted on GitHub via JSDelivr)
   const scriptFiles = [
      "parser.js",
      "renderHistory.js",
      "codeExecution.js",
      "markdown.js",
      "procedures.js",
   ];

   // Generate script tags using JSDelivr URLs and set them as ES modules
   const scriptTags = scriptFiles
      .map(
         (file) =>
            `<script type="module" src="${cdnBaseURL}${file}" defer></script>`
      )
      .join("\n");

   // Inline script to restore variables, run variableReader, and then execute parser
   const inlineScript = `
   <script type="module">
      import { parser, variableReader } from "${cdnBaseURL}parser.js"; // Import both from parser.js

      document.addEventListener("DOMContentLoaded", () => {
         console.log("Restoring steps and running variableReader...");

         const steps = JSON.parse(decodeURIComponent('${stepsJSON}'));
         const text = decodeURIComponent('${textEncoded}');

         variableReader(text); // Process the text first
         parser(steps, 0); // Then run the parser with the steps
      });
   </script>`;

   // Full HTML with externally hosted scripts via JSDelivr
   const fullHTML = `
   <!DOCTYPE html>
   <html lang="en">
   <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Generated Page</title>
      <link rel="stylesheet" href="https://cdn.simplecss.org/simple.css"> <!-- Simple.css -->
   </head>
   <body>
      <div id="website_content"></div> <!-- Only this element, everything else is in JS -->

      ${scriptTags} <!-- Load JavaScript from JSDelivr (as modules) -->
      ${inlineScript} <!-- Restore variables, run variableReader, and execute parser -->
   </body>
   </html>`;

   // Create a Blob and generate a download link
   const blob = new Blob([fullHTML], { type: "text/html" });
   const link = document.createElement("a");
   link.href = URL.createObjectURL(blob);
   link.download = "interactive_page.html";
   document.body.appendChild(link);
   link.click();
   document.body.removeChild(link);
}
