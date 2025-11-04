import { variableReader, parser } from "./parser.js";
import { downloadGeneratedPage } from "./downloadPage.js";

// Runtime logic (for interaction, navigation, etc.)
import {
   initializeInputHandling,
   initializeQuestionButtons,
   initializeNavigation,
   executeShowIf,
   updateInlineVariables,
   executeCodeBlocks,
} from "./procedureRuntime.js";

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

async function generateProcedure() {
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

   // add simple.css
   const link = document.createElement("link");
   link.rel = "stylesheet";
   link.href = "https://cdn.simplecss.org/simple.css";
   document.head.appendChild(link);

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

   // === Set up parser and runtime state ===
   // window.storedString = inputText;
   try {
      window.finished = true;
      window.currentStep = 0;
      window.allSteps = 1;

      // 1) Read variables from the input text
      const variables = variableReader(inputText);

      console.log("[inputText]: ", [inputText]);

      // 2) Parse the pseudo-code into DOM elements
      let parsedContent = await parser([inputText], 0, inputText);

      // 3) Append parsed content into the page (live)
      appendParsedSteps(parsedContent, websiteContent);
      // Hide all steps except step0 (mirror download behavior)
      const totalSteps = document.querySelectorAll('[class^="step"]').length;
      for (let i = 0; i < totalSteps; i++) {
         const step = document.querySelector(".step" + i);
         if (step) step.style.display = i === 0 ? "block" : "none";
      }

      // 4) Initialize runtime logic
      initializeInputHandling(variables);
      initializeQuestionButtons(variables);

      executeCodeBlocks(variables);
      updateInlineVariables(variables);
      executeShowIf(variables);

      initializeNavigation({
         executeAllCodeBlocks: () => executeCodeBlocks(variables),
         updateInlineVariables: () => updateInlineVariables(variables),
         evaluateConditions: () => executeShowIf(variables),
      });
   } catch (error) {
      console.log("[generateProcedure] error: ", error);
   }
}

function appendParsedSteps(parsedContent, container) {
   let currentStep = [];
   let stepCounter = 0;

   function flush() {
      const stepDiv = document.createElement("div");
      stepDiv.classList.add("step" + stepCounter);

      currentStep.forEach((el) => stepDiv.appendChild(el.cloneNode(true)));

      const nav = document.createElement("div");
      nav.classList.add("nav-buttons");
      stepDiv.appendChild(nav);

      console.log("StepDiv: ", stepDiv);
      container.appendChild(stepDiv);
      stepCounter++;
      currentStep = [];
   }

   // parsedContent[0] should be your array of DOM elements
   (parsedContent[0] || []).forEach((el) => {
      if (el.classList.contains("line-separator")) {
         console.log("Flush function runs ");
         flush();
      } else {
         currentStep.push(el);
      }
   });

   // Flush any remaining elements
   // !WARNING Need to check if it creates empty steps
   if (currentStep.length > 0) flush();
}

function restoreInputPage() {
   // === Remove Simple.css if present ===
   const simpleCss = document.querySelector(
      'link[href="https://cdn.simplecss.org/simple.css"]'
   );
   if (simpleCss) simpleCss.remove();

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
