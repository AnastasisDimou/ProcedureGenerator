import { parser, variableReader } from "./parser.js";

export async function downloadGeneratedPage(steps, text) {
   // Encode steps and text to ensure proper JSON formatting

   // Base URL for JSDelivr with @latest to always get the latest version

   // Generate script tags using JSDelivr URLs and set them as ES modules
   // Full HTML with externally hosted scripts via JSDelivr
   let variables = variableReader(text);
   let parsedContent = await parser(steps, 0);

   function wrapStep(elements, stepIndex) {
      const stepDiv = document.createElement("div");
      stepDiv.classList.add("step" + stepIndex);

      elements.forEach((el) => stepDiv.appendChild(el.cloneNode(true)));

      // Include an empty nav-buttons div (no buttons yet)
      const nav = document.createElement("div");
      nav.classList.add("nav-buttons");
      stepDiv.appendChild(nav);

      return stepDiv.outerHTML;
   }

   let renderedHTML = "";
   let currentStep = [];
   let stepCounter = 0;

   parsedContent[0].forEach((el) => {
      if (el.classList.contains("line-separator")) {
         // flush before the separator
         renderedHTML += wrapStep(currentStep, stepCounter++);
         currentStep = [];
      } else {
         currentStep.push(el);
      }
   });

   // flush remaining
   if (currentStep.length > 0) {
      renderedHTML += wrapStep(currentStep, stepCounter++);
   }

   const variablesScript = `
      <script defer>
         const variables = ${JSON.stringify(variables)};
         console.log("Variables restored:", variables);
      </script>
   `;

   const inputQuestionsJS = `
   <script defer>
      function handleInput(input) {
         if (input.value.trim() !== "" && input.checkValidity()) {
            input.style.outline = "2px solid #e64833";
            input.style.border = "2px solid #e64833";
   
            const key = input.name;
            if (variables.hasOwnProperty(key)) {
               variables[key] = input.value;
               console.log("Updated variables:", variables);
            } else {
               console.log("Skipped input, no variable:", key);
            }
         }
      }
   
      function enhanceInputs() {
         document.querySelectorAll("input").forEach(input => {
            input.addEventListener("keydown", (e) => {
               if (e.key === "Enter") {
                  e.preventDefault();
                  handleInput(input);
               }
            });
            input.addEventListener("blur", () => handleInput(input));
         });
      }
   
      document.addEventListener("DOMContentLoaded", () => {
         enhanceInputs();
      });
   </script>
   `;

   const buttonScript = `
   <script defer>
   document.addEventListener("DOMContentLoaded", () => {
      const containers = document.querySelectorAll('#website_content .question-block');
   
      containers.forEach(container => {
         const key = container.getAttribute("data-var");
   
         container.addEventListener("click", (e) => {
            const clickedButton = e.target.closest('button');
            if (!clickedButton) return;
   
            if (!variables.hasOwnProperty(key)) {
               console.log("Skipped click, no variable for:", key);
               return;
            }
   
            const buttonsInContainer = container.querySelectorAll('button');
            buttonsInContainer.forEach(btn => {
               btn.style.backgroundColor = "";
               btn.style.outline = "";
            });
   
            clickedButton.style.backgroundColor = "#e64833";
            clickedButton.style.outline = "2px solid #ffffff";
   
            variables[key] = clickedButton.innerText;
            console.log("Updated variables:", variables);
         });
      });
   });
   </script>
   `;

   const navScript = `
   <script defer>
      let currentStep = 0;
      const visitedSteps = [0];
   
      function getTotalSteps() {
         return document.querySelectorAll('[class^="step"]').length;
      }
   
      function initializePage() {
         const totalSteps = getTotalSteps();
         for (let i = 0; i < totalSteps; i++) {
            const step = document.querySelector(".step" + i);
            if (step) step.style.display = i === 0 ? "block" : "none";
         }
         appendNavButtons();
         executeAllCodeBlocks();
         updateInlineVariables();
         evaluateConditions();
      }
   
      function showStep(index) {
         const step = document.querySelector(".step" + index);
         if (!step) return;
         step.style.display = "block";
      }
   
      function hideStepsAfter(index) {
         const total = getTotalSteps();
         for (let i = index + 1; i < total; i++) {
            const step = document.querySelector(".step" + i);
            if (step) step.style.display = "none";
         }
      }
   
      function scrollToStep(index) {
         const step = document.querySelector(".step" + index);
         if (!step) return;
         step.setAttribute("tabindex", "-1");
         step.focus({ preventScroll: false });
         step.scrollIntoView({ behavior: "smooth", block: "start" });
      }
   
      function appendNavButtons() {
         document.querySelectorAll(".nav-buttons").forEach(container => {
            container.innerHTML = "";
         });
   
         const step = document.querySelector(".step" + currentStep);
         const buttonContainer = step.querySelector(".nav-buttons");
         if (!buttonContainer) return;
   
         if (visitedSteps.length > 1) {
            const backButton = document.createElement("button");
            backButton.textContent = "Back";
            backButton.addEventListener("click", () => {
               visitedSteps.pop();
               currentStep = visitedSteps[visitedSteps.length - 1];
               hideStepsAfter(currentStep);
               scrollToStep(currentStep);
               appendNavButtons();
            });
            buttonContainer.appendChild(backButton);
         }
   
         if (currentStep < getTotalSteps() - 1) {
            const nextButton = document.createElement("button");
            nextButton.textContent = "Next";
            nextButton.addEventListener("click", () => {
               currentStep++;
               visitedSteps.push(currentStep);
               showStep(currentStep);
               scrollToStep(currentStep);
   
               updateInlineVariables();   
               evaluateConditions();     
               appendNavButtons();
            });
            buttonContainer.appendChild(nextButton);
         }
      }
   
      window.addEventListener("load", () => {
         setTimeout(initializePage, 0);
      });
   </script>
   `;

   const executeShowIf = `
   <script defer>
      function evaluateConditions() {
         console.log("[evaluateConditions] Running...");
         const visibleSteps = [...document.querySelectorAll('[class^="step"]')]
            .filter(div => div.style.display !== 'none');

         visibleSteps.forEach(step => {
            const ifBlocks = step.querySelectorAll('.if');
            ifBlocks.forEach(ifDiv => {
               const expr = ifDiv.getAttribute('data-expression')?.trim();
               if (!expr) return;

               let result = false;

               try {
                  const evaluate = new Function(
                     ...Object.keys(variables),
                     \`try { return \${expr}; } catch (error) {
                        if (error instanceof ReferenceError) return true;
                        throw error;
                     }\`
                  );
                  result = evaluate(...Object.values(variables));
                  console.log(\`[evaluateConditions] Expression: "\${expr}" → Result: \${result}\`);
               } catch (e) {
                  console.warn("Failed to evaluate condition:", expr, e);
               }

               // Hide or show the whole conditional block
               ifDiv.style.display = result ? 'block' : 'none';
            });
         });
      }
   </script>
`;

   const executeInlineVariables = `
      <script defer>
         function checkForCodeInLine(line) {
            const regex = /\\{\\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*\\}/g;
            return line.replace(regex, (_, varName) => variables[varName] ?? \`{\${varName}}\`);
         }
      
         function updateInlineVariables() {
            const divs = document.querySelectorAll("div:not(.if):not(.code)");
      
            divs.forEach(div => {
               const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT, null, false);
               let node;
               while ((node = walker.nextNode())) {
                  // Cache original if not already stored
                  if (!node.parentElement.hasAttribute("data-original")) {
                     node.parentElement.setAttribute("data-original", node.textContent);
                  }
      
                  const original = node.parentElement.getAttribute("data-original");
                  node.textContent = checkForCodeInLine(original);
               }
            });
         }
      </script>
   `;

   const executeCodeBlocks = `
   <script defer>
      function executeAllCodeBlocks() {
         const visibleSteps = [...document.querySelectorAll('[class^="step"]')]
            .filter(div => div.style.display !== 'none');
   
         visibleSteps.forEach(step => {
            const codeBlocks = step.querySelectorAll("div.code");
   
            codeBlocks.forEach(div => {
   
               const userCode = div.textContent.trim();
               if (!userCode) return;
   
               try {
                  const wrappedFunction = new Function(
                     ...Object.keys(variables),
                     \`\${userCode}; return { \${Object.keys(variables).join(", ")} };\`
                  );
                  const updatedVariables = wrappedFunction(...Object.values(variables));
                  Object.assign(variables, updatedVariables);
               } catch (e) {
                  console.warn("Error evaluating code block:", userCode, e);
               }
   
               div.style.display = "none";
            });
         });
      }
   </script>
   `;

   const fullHTML = `
   <!DOCTYPE html>
   <html lang="en">
   <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Generated Page</title>
      <style>
         div.code {
            display: none !important;
         }
      </style>
      <link rel="stylesheet" href="https://cdn.simplecss.org/simple.css"> <!-- Simple.css -->
   </head>
   <body>
      <div id="website_content">
         ${renderedHTML} <!-- show only the first parsed step statically here -->
      </div>
      ${variablesScript}
      ${inputQuestionsJS}
      ${buttonScript}
      ${executeCodeBlocks}
      ${executeInlineVariables}
      ${executeShowIf}
      ${navScript}
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
