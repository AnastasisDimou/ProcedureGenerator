import {
   variableReader,
   parser,
   splitSteps,
   getRepeatStepConditions, // NEW
} from "./parser.js";
import { downloadGeneratedPage } from "./downloadPage.js";

// Runtime logic (for interaction, navigation, etc.)
import {
   initializeInputHandling,
   initializeQuestionButtons,
   initializeNavigation,
   executeShowIf,
   updateInlineVariables,
   executeCodeBlocks,
   evaluateExpression,
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

   const style = document.createElement("style");
   style.id = "procedure-styles";
   style.textContent = `
  .block-styling {
    padding: 15px;
    border: 1px solid transparent;
    margin-bottom: 20px;
    border-radius: 4px;
  }

  .warning-styling {
    color: #856404;
    background-color: #fff3cd;
    border-color: #ffeeba;
  }

  .error-styling {
    color: #721c24;
    background-color: #f8d7da;
    border-color: #f5c6cb;
  }

  .info-styling {
    color: #0c5460;
    background-color: #d1ecf1;
    border-color: #bee5eb;
  }

  .success-styling {
    color: #3c763d;
    background-color: #dff0d8;
    border-color: #d6e9c6;
  }
`;
   document.head.appendChild(style);

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

   try {
      window.finished = true;
      window.currentStep = 0;
      window.allSteps = 1;

      // 1) Read variables from the input text
      const variables = variableReader(inputText);
      console.log("Extracted variables: ");
      console.log(JSON.parse(JSON.stringify(variables)));
      window._vars = variables;

      const steps = splitSteps(inputText);

      // 2) Parse the pseudo-code into DOM elements
      let parsedContent = await parser(steps, 0, inputText);

      // NEW: get per-step RepeatStep conditions from parser
      const repeatStepConditions = getRepeatStepConditions();

      // 3) Append parsed content into the page (live)
      appendParsedSteps(parsedContent, websiteContent, repeatStepConditions);

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

      // NEW: wire up whole-step RepeatStep logic on the standard Next button
      setupRepeatStepNavigation(variables);
   } catch (error) {
      console.log("[generateProcedure] error: ", error);
   }
}

function appendParsedSteps(parsedContent, container, repeatStepConditions) {
   let currentStep = [];
   let stepCounter = 0;

   function flush() {
      const stepDiv = document.createElement("div");
      stepDiv.classList.add("step" + stepCounter);

      // Attach RepeatStep condition (if any) to the step wrapper
      if (
         repeatStepConditions &&
         Object.prototype.hasOwnProperty.call(repeatStepConditions, stepCounter)
      ) {
         stepDiv.setAttribute(
            "data-repeat-step-until",
            repeatStepConditions[stepCounter]
         );
      }

      currentStep.forEach((el) => stepDiv.appendChild(el.cloneNode(true)));

      const nav = document.createElement("div");
      nav.classList.add("nav-buttons");
      stepDiv.appendChild(nav);

      container.appendChild(stepDiv);
      stepCounter++;
      currentStep = [];
   }

   (parsedContent[0] || []).forEach((el) => {
      if (el.classList.contains("line-separator")) {
         flush();
      } else {
         currentStep.push(el);
      }
   });

   if (currentStep.length > 0) flush();
}

// === RepeatStep runtime ===

let repeatStepNavInitialized = false;
let currentRepeatStepVariables = null;

function clearStepIteration(stepDiv, variables) {
   if (!stepDiv) return;

   // Clear inputs (UI only)
   stepDiv.querySelectorAll("input").forEach((input) => {
      if (input.type === "checkbox" || input.type === "radio") {
         input.checked = false;
      } else {
         input.value = "";
      }
   });

   // Clear multiple-choice buttons (UI only)
   stepDiv.querySelectorAll(".question-block").forEach((block) => {
      block.querySelectorAll("button").forEach((button) => {
         button.style.backgroundColor = "";
         button.style.outline = "";
      });
   });

   // ⚠️ Do NOT touch `variables` here.
}

function setupRepeatStepNavigation(variables) {
   // Keep latest variables reference for the global listener
   currentRepeatStepVariables = variables;

   if (repeatStepNavInitialized) return;
   repeatStepNavInitialized = true;

   // Capture-phase so we can stop the default Next handler if needed
   document.addEventListener(
      "click",
      (event) => {
         const btn = event.target.closest(".nav-buttons button");
         if (!btn) return;

         if (btn.textContent.trim().toLowerCase() !== "next") return;

         const stepDiv = btn.closest('[class^="step"]');
         if (!stepDiv) return;

         const expr = stepDiv.getAttribute("data-repeat-step-until");
         if (!expr) return; // no RepeatStep on this step

         const vars = currentRepeatStepVariables;
         if (!vars) return;

         const ok = evaluateExpression(expr, vars);

         if (!ok) {
            // Condition NOT satisfied → repeat this step instead of moving on
            event.preventDefault();
            event.stopPropagation();
            if (event.stopImmediatePropagation) {
               event.stopImmediatePropagation();
            }

            clearStepIteration(stepDiv, vars);
            executeCodeBlocks(vars);
            updateInlineVariables(vars);
            executeShowIf(vars);
         }
         // If ok === true, do nothing here → normal Next handler runs
      },
      true
   );
}

function restoreInputPage() {
   const simpleCss = document.querySelector(
      'link[href="https://cdn.simplecss.org/simple.css"]'
   );
   if (simpleCss) simpleCss.remove();

   document.body.innerHTML = `
    <textarea id="inputBox" placeholder="Type here...">${
       localStorage.getItem("storedInput") || ""
    }</textarea>
    <div class="button-container">
      <button id="generateButton">Generate</button>
    </div>
  `;

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

   document
      .getElementById("generateButton")
      .addEventListener("click", generateProcedure);
}
