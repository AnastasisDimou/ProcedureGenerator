import { variableReader, parser } from "./parser.js";
import { downloadGeneratedPage } from "./downloadPage.js";

document.addEventListener("DOMContentLoaded", () => {
   const button = document.getElementById("generateButton");
   if (button) button.addEventListener("click", generateProcedure);
   initializePage();
});

function initializePage() {
   const savedInput = localStorage.getItem("storedInput");
   const inputBox = document.getElementById("inputBox");
   if (savedInput && inputBox) inputBox.value = savedInput;
}

function generateProcedure() {
   const inputBox = document.getElementById("inputBox");
   const buttonContainer = document.querySelector(".button-container");
   const inputText = inputBox.value.trim();

   if (!inputText) return;

   // Save input
   localStorage.setItem("storedInput", inputText);

   // Remove all previous styles, textarea, and buttons
   document
      .querySelectorAll("style, link[rel='stylesheet']")
      .forEach((el) => el.remove());
   if (inputBox) inputBox.remove();
   if (buttonContainer) buttonContainer.remove();

   // Apply black background and white text
   document.body.style.backgroundColor = "#000";
   document.body.style.color = "#fff";
   document.body.style.margin = "0";
   document.body.style.padding = "0";
   document.body.style.fontFamily = "FiraCode Nerd Font Mono, monospace";

   // Create Back button
   const backButton = document.createElement("button");
   backButton.innerText = "Back";
   backButton.style.position = "fixed";
   backButton.style.top = "10px";
   backButton.style.left = "10px";
   backButton.style.backgroundColor = "#007bff";
   backButton.style.color = "#fff";
   backButton.style.border = "none";
   backButton.style.padding = "10px 20px";
   backButton.style.borderRadius = "5px";
   backButton.style.cursor = "pointer";
   backButton.style.fontSize = "16px";
   backButton.onclick = restoreInputPage;

   document.body.appendChild(backButton);

   // Create Download button
   const downloadButton = document.createElement("button");
   downloadButton.innerText = "Download Page";
   downloadButton.style.position = "fixed";
   downloadButton.style.bottom = "20px";
   downloadButton.style.right = "20px";
   downloadButton.style.backgroundColor = "#28a745";
   downloadButton.style.color = "#fff";
   downloadButton.style.border = "none";
   downloadButton.style.padding = "10px 20px";
   downloadButton.style.borderRadius = "5px";
   downloadButton.style.cursor = "pointer";
   downloadButton.style.fontSize = "16px";
   downloadButton.onclick = () => downloadGeneratedPage([inputText], inputText);

   document.body.appendChild(downloadButton);

   // Create main content area
   const websiteContent = document.createElement("div");
   websiteContent.id = "website_content";
   websiteContent.style.padding = "20px";
   document.body.appendChild(websiteContent);

   // Parse and render
   window.storedString = inputText;
   window.finished = true;
   window.currentStep = 0;
   window.allSteps = 1;

   variableReader(inputText);
   parser([inputText], 0);
}

function restoreInputPage() {
   // Reset body completely
   document.body.innerHTML = `
    <textarea id="inputBox" placeholder="Type here...">${
       localStorage.getItem("storedInput") || ""
    }</textarea>
    <div class="button-container">
      <button id="generateButton">Generate</button>
    </div>
  `;

   // Reapply original style
   const style = document.createElement("style");
   style.textContent = `
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      overflow: hidden;
    }
    textarea {
      width: 100%;
      height: 100%;
      border: none;
      outline: none;
      resize: none;
      font-family: "FiraCode Nerd Font Mono", monospace;
      font-size: 16px;
      padding: 10px;
      box-sizing: border-box;
    }
    .button-container {
      position: absolute;
      top: 10px;
      right: 10px;
    }
    button {
      font-family: Arial, sans-serif;
      font-size: 14px;
      padding: 8px 16px;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover {
      background-color: #0056b3;
    }
  `;
   document.head.appendChild(style);

   // Rebind Generate button
   document
      .getElementById("generateButton")
      .addEventListener("click", generateProcedure);
}
