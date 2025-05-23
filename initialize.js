import { variableReader } from "./parser.js";
import { parser } from "./parser.js";
import { downloadGeneratedPage } from "./downloadPage.js";

document.addEventListener("DOMContentLoaded", () => {
   const button = document.getElementById("generateButton");
   if (button) button.addEventListener("click", storeInput);
});

// Function to initialize the page and restore saved input
function initializePage() {
   const savedInput = localStorage.getItem("storedInput");
   const inputBox = document.getElementById("inputBox");
   if (savedInput && inputBox) {
      inputBox.value = savedInput; // Load saved input into textarea
   }
}

function storeInput() {
   // Remove all <style> elements
   const styleElements = document.querySelectorAll("style");
   styleElements.forEach((style) => style.remove());

   // Add the external CSS file
   const linkElement = document.createElement("link");
   linkElement.rel = "stylesheet";
   linkElement.href = "https://cdn.simplecss.org/simple.css";

   // Append the <link> to the <head>
   document.head.appendChild(linkElement);

   // Retrieve the content from the textarea
   const inputText = document.getElementById("inputBox").value;

   // Save the content to localStorage
   localStorage.setItem("storedInput", inputText);

   // Remove the textarea and button container from the DOM
   const inputBox = document.getElementById("inputBox");
   const buttonContainer = document.querySelector(".button-container");
   if (inputBox) inputBox.remove();
   if (buttonContainer) buttonContainer.remove();

   const spacer = document.createElement("div");
   spacer.style.width = "100px"; // Adjust based on button size
   spacer.style.height = "50px"; // Same height as button
   spacer.style.display = "inline-block"; // Keeps it from collapsing

   document.body.insertBefore(spacer, document.body.firstChild);

   const backButton = document.createElement("button");
   backButton.className = "back-button";
   backButton.innerText = "Back";
   backButton.onclick = restoreInputPage;

   // css for the button
   backButton.style.position = "fixed";
   backButton.style.top = "10px"; // Slight padding from the top
   backButton.style.left = "10px"; // Slight padding from the left
   backButton.style.backgroundColor = "#007bff"; // Blue background
   backButton.style.color = "#fff"; // White text
   backButton.style.border = "none";
   backButton.style.padding = "10px 20px";
   backButton.style.borderRadius = "5px";
   backButton.style.cursor = "pointer";
   backButton.style.fontSize = "16px";

   document.body.insertBefore(backButton, document.body.firstChild.nextSibling);

   document.body.appendChild(spacer);

   // Spacer for Download button
   const downloadSpacer = document.createElement("div");
   downloadSpacer.style.width = "100px";
   downloadSpacer.style.height = "60px"; // Adjusted height to prevent collisions
   downloadSpacer.style.display = "inline-block";

   // const steps = splitSteps(inputText);
   const steps = [inputText];

   // Create Download button (Bottom-Right Corner)
   const downloadButton = document.createElement("button");
   downloadButton.className = "download-button";
   downloadButton.innerText = "Download Page";
   downloadButton.onclick = () => downloadGeneratedPage(steps, inputText);

   // Style the Download button
   downloadButton.style.position = "fixed";
   downloadButton.style.bottom = "20px";
   downloadButton.style.right = "20px";
   downloadButton.style.backgroundColor = "#28a745"; // Green background
   downloadButton.style.color = "#fff";
   downloadButton.style.border = "none";
   downloadButton.style.padding = "10px 20px";
   downloadButton.style.borderRadius = "5px";
   downloadButton.style.cursor = "pointer";
   downloadButton.style.fontSize = "16px";

   document.body.appendChild(downloadButton);
   document.body.appendChild(downloadSpacer); // Add spacer for Download button

   // Initialize variables and parsing
   window.storedString = inputText;
   window.finished = true;
   window.currentStep = 0;
   window.allSteps = 1;

   const website_content = document.createElement("div");
   website_content.id = "website_content";
   const websiteText = document.createElement("div");
   websiteText.id = "websiteText";

   document.body.appendChild(website_content);
   document.body.appendChild(websiteText);

   variableReader(inputText);
   parser(steps, 0);
   // renderSteps(array, 0);
}

// Function to restore the previous page with the stored input
function restoreInputPage() {
   // Remove the external CSS file
   const externalLink = document.querySelector(
      'link[href="https://cdn.simplecss.org/simple.css"]'
   );
   if (externalLink) externalLink.remove();

   // Restore the old styles (if necessary, you can add specific styles dynamically)
   const oldStyle = document.createElement("style");
   oldStyle.textContent = `
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
   document.head.appendChild(oldStyle);

   // Retrieve the stored input from localStorage
   const storedInput = localStorage.getItem("storedInput") || "";

   // Clear the current page content and restore the original structure
   document.body.innerHTML = `
      <textarea id="inputBox" placeholder="Type here...">${storedInput}</textarea>
      <div class="button-container">
         <button onclick="storeInput()">Generate</button>
      </div>
   `;
   // document
   //    .getElementById("generateButton")
   //    .addEventListener("click", storeInput);
}

// Call initializePage when the script runs
window.onload = initializePage;
window.storeInput = storeInput;
window.restoreInputPage = restoreInputPage;
