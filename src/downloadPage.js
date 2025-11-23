import { parser, variableReader } from "./parser.js";

export async function downloadGeneratedPage(steps, text) {
   // Encode steps and text to ensure proper JSON formatting

   // Base URL for JSDelivr with @latest to always get the latest version

   // Generate script tags using JSDelivr URLs and set them as ES modules
   // Full HTML with externally hosted scripts via JSDelivr
   let variables = variableReader(text);
   let parsedContent = await parser(steps, 0, text);

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

   const runtimeScript = `
<script>
   // Restore variables from the generator
   const variables = ${JSON.stringify(variables)};
   console.log("Variables restored:", variables);

   // ====== Inline versions of proceduresRuntime.js functions ======

   function initializeInputHandling(variables) {
      function handleInput(input) {
         if (input.value.trim() !== "" && input.checkValidity()) {
            input.style.outline = "2px solid #e64833";
            input.style.border = "2px solid #e64833";

            const key = input.name;
            if (Object.prototype.hasOwnProperty.call(variables, key)) {
               variables[key] = input.value;
               console.log("Updated variables:", variables);
            } else {
               console.log("Skipped input, no variable:", key);
            }
         }
      }

      function enhanceInputs() {
         document.querySelectorAll("input").forEach((input) => {
            input.addEventListener("keydown", (e) => {
               if (e.key === "Enter") {
                  e.preventDefault();
                  handleInput(input);
               }
            });
            input.addEventListener("blur", () => handleInput(input));
         });
      }

      enhanceInputs();
   }

   function initializeQuestionButtons(variables) {
      const containers = document.querySelectorAll("#website_content .question-block");

      containers.forEach((container) => {
         const key = container.getAttribute("data-var");
         if (!key) return;

         container.addEventListener("click", (e) => {
            const clickedButton = e.target.closest("button");
            if (!clickedButton) return;
            if (!Object.prototype.hasOwnProperty.call(variables, key)) return;

            const allButtons = container.querySelectorAll("button");
            allButtons.forEach((btn) => {
               btn.style.backgroundColor = "";
               btn.style.outline = "";
            });

            clickedButton.style.backgroundColor = "#e64833";
            clickedButton.style.outline = "2px solid #ffffff";
            variables[key] = clickedButton.innerText;
            console.log("Updated variable " + key + ":", variables[key]);
         });
      });
   }

   function initializeNavigation({ executeAllCodeBlocks, updateInlineVariables, evaluateConditions }) {
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

         executeAllCodeBlocks();
         updateInlineVariables();
         evaluateConditions();
         appendNavButtons();
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
         document.querySelectorAll(".nav-buttons").forEach((container) => {
            container.innerHTML = "";
         });

         const step = document.querySelector(".step" + currentStep);
         const buttonContainer = step?.querySelector(".nav-buttons");
         if (!buttonContainer) return;

         function hasVisibleEnd(step) {
            if (!step) return false;

            // 1) Reset anything previously hidden due to an {end}
            step.querySelectorAll('[data-hidden-by-end="true"]').forEach((el) => {
               el.style.display = "";
               el.removeAttribute("data-hidden-by-end");
            });

            const ends = Array.from(step.querySelectorAll(".end"));
            if (!ends.length) return false;

            function isEffectivelyVisible(el) {
               if (!el) return false;
               let node = el;
               while (node && node.nodeType === 1) {
                  const style = getComputedStyle(node);
                  if (style.display === "none" || style.visibility === "hidden") {
                     return false;
                  }
                  node = node.parentElement;
               }
               return true;
            }

            const visibleEnds = ends.filter(isEffectivelyVisible);
            if (!visibleEnds.length) return false;

            let earliest = visibleEnds[0];
            visibleEnds.forEach((end) => {
               if (end === earliest) return;
               const pos = earliest.compareDocumentPosition(end);
               if (pos & Node.DOCUMENT_POSITION_PRECEDING) {
                  earliest = end;
               }
            });

            const walker = document.createTreeWalker(
               step,
               NodeFilter.SHOW_ELEMENT,
               null,
               false
            );

            let node;
            let pastEnd = false;
            while ((node = walker.nextNode())) {
               if (node === earliest) {
                  pastEnd = true;
                  continue;
               }
               if (!pastEnd) continue;
               if (node.closest(".nav-buttons")) continue;

               node.dataset.hiddenByEnd = "true";
               node.style.display = "none";
            }

            return true;
         }

         const isEndStep = hasVisibleEnd(step);

         if (isEndStep) {
            const endMessage = document.createElement("div");
            endMessage.textContent = "End of procedure";
            endMessage.style.fontWeight = "bold";
            endMessage.style.marginBottom = "10px";
            buttonContainer.appendChild(endMessage);
         }

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

         if (!isEndStep && currentStep < getTotalSteps() - 1) {
            const nextButton = document.createElement("button");
            nextButton.textContent = "Next";
            nextButton.addEventListener("click", () => {
               currentStep++;
               visitedSteps.push(currentStep);
               showStep(currentStep);
               scrollToStep(currentStep);

               executeAllCodeBlocks();
               updateInlineVariables();
               evaluateConditions();
               appendNavButtons();
            });
            buttonContainer.appendChild(nextButton);
         }
      }

      if (document.readyState === "complete" || document.readyState === "interactive") {
         setTimeout(initializePage, 0);
      } else {
         window.addEventListener("load", () => setTimeout(initializePage, 0));
      }
   }

   function evaluateExpression(expr, variables) {
      if (!expr) return false;
      const trimmed = expr.trim();
      if (!trimmed) return false;

      try {
         const argNames = Object.keys(variables);
         const fnBody =
            "try {\\n" +
            "   return (" + trimmed + ");\\n" +
            "} catch (error) {\\n" +
            "   if (error instanceof ReferenceError) return false;\\n" +
            "   throw error;\\n" +
            "}";

         const evaluate = new Function(...argNames, fnBody);
         return !!evaluate(...Object.values(variables));
      } catch (e) {
         console.warn("[evaluateExpression] FAILED:", expr, e);
         return false;
      }
   }

   function executeShowIf(variables) {
      console.log("[executeShowIf] Evaluating conditions...");

      const allIfBlocks = document.querySelectorAll(".if");

      allIfBlocks.forEach((ifDiv) => {
         const stepParent = ifDiv.closest('[class^="step"]');
         if (!stepParent) {
            console.warn("[executeShowIf] ifDiv has no step parent:", ifDiv);
            return;
         }

         const visible = getComputedStyle(stepParent).display !== "none";
         if (!visible) return;

         const exprAttr = ifDiv.getAttribute("data-expression");
         const expr = exprAttr ? exprAttr.trim() : "";
         console.log('[executeShowIf] Expression: "' + expr + '"');
         if (!expr) return;

         const result = evaluateExpression(expr, variables);
         ifDiv.style.display = result ? "block" : "none";
      });
   }

   function updateInlineVariables(variables) {
      function checkForCodeInLine(line) {
         const regex = /\\{\\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*\\}/g;
         return line.replace(regex, function(_, varName) {
            if (Object.prototype.hasOwnProperty.call(variables, varName) && variables[varName] != null) {
               return variables[varName];
            }
            return "{" + varName + "}";
         });
      }

      const divs = document.querySelectorAll("div:not(.if):not(.code)");

      divs.forEach((div) => {
         const walker = document.createTreeWalker(
            div,
            NodeFilter.SHOW_TEXT,
            null,
            false
         );
         let node;
         while ((node = walker.nextNode())) {
            if (!node.parentElement.hasAttribute("data-original")) {
               node.parentElement.setAttribute("data-original", node.textContent);
            }

            const original = node.parentElement.getAttribute("data-original");
            node.textContent = checkForCodeInLine(original);
         }
      });
   }

   function executeCodeBlocks(variables) {
      console.log("[executeCodeBlocks] Running code blocks with variables:", variables);

      const visibleSteps = Array.from(document.querySelectorAll('[class^="step"]'))
         .filter((div) => div.style.display !== "none");

      if (!visibleSteps.length) return;

      const currentStepDiv = visibleSteps[visibleSteps.length - 1];
      const codeBlocks = currentStepDiv.querySelectorAll("div.code");

      codeBlocks.forEach((div) => {
         const userCode = div.textContent.trim();
         if (!userCode) return;

         try {
            const fnBody =
               "// Run user code with 'vars' as the scope object\\n" +
               "with (vars) {\\n" +
               userCode +
               "\\n}";

            const wrapped = new Function("vars", fnBody);
            wrapped(variables);
         } catch (e) {
            console.warn("Error evaluating code block:", userCode, e);
         }

         div.style.display = "none";
      });

      console.log("[executeCodeBlocks] Variables after execution:", variables);
   }

   // ====== Kick everything off ======
   initializeInputHandling(variables);
   initializeQuestionButtons(variables);
   initializeNavigation({
      executeAllCodeBlocks: function() { executeCodeBlocks(variables); },
      updateInlineVariables: function() { updateInlineVariables(variables); },
      evaluateConditions: function() { executeShowIf(variables); }
   });
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
