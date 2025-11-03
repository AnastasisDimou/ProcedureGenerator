export function initializeInputHandling(variables) {
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

   // Call immediately to attach listeners
   enhanceInputs();
}

export function initializeQuestionButtons(variables) {
   const containers = document.querySelectorAll(
      "#website_content .question-block"
   );

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
         console.log(`Updated variable ${key}:`, variables[key]);
      });
   });
}

export function initializeNavigation({
   executeAllCodeBlocks,
   updateInlineVariables,
   evaluateConditions,
}) {
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
      document.querySelectorAll(".nav-buttons").forEach((container) => {
         container.innerHTML = "";
      });

      const step = document.querySelector(".step" + currentStep);
      const buttonContainer = step?.querySelector(".nav-buttons");
      if (!buttonContainer) return;

      const isEndStep = step.querySelector(".end") !== null;

      // End message
      if (isEndStep) {
         const endMessage = document.createElement("div");
         endMessage.textContent = "End of procedure";
         endMessage.style.fontWeight = "bold";
         endMessage.style.marginBottom = "10px";
         buttonContainer.appendChild(endMessage);
      }

      // Back button
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

      // Next button
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

   // Initialize once the page is fully loaded
   window.addEventListener("load", () => {
      setTimeout(initializePage, 0);
   });
}

//showifs
export function executeShowIf(variables) {
   console.log("[evaluateConditions] Running...");

   // Select only visible steps
   const visibleSteps = [
      ...document.querySelectorAll('[class^="step"]'),
   ].filter((div) => div.style.display !== "none");

   visibleSteps.forEach((step) => {
      const ifBlocks = step.querySelectorAll(".if");

      ifBlocks.forEach((ifDiv) => {
         const expr = ifDiv.getAttribute("data-expression")?.trim();
         if (!expr) return;

         let result = false;

         try {
            const evaluate = new Function(
               ...Object.keys(variables),
               `try { 
                  return ${expr}; 
               } catch (error) {
                  if (error instanceof ReferenceError) return true;
                  throw error;
               }`
            );

            result = evaluate(...Object.values(variables));
            console.log(
               `[evaluateConditions] Expression: "${expr}" → Result: ${result}`
            );
         } catch (e) {
            console.warn("Failed to evaluate condition:", expr, e);
         }

         // Show or hide conditional blocks
         ifDiv.style.display = result ? "block" : "none";
      });
   });
}

export function updateInlineVariables(variables) {
   function checkForCodeInLine(line) {
      const regex = /\{\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\}/g;
      return line.replace(
         regex,
         (_, varName) => variables[varName] ?? `{${varName}}`
      );
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
         // Cache original text the first time
         if (!node.parentElement.hasAttribute("data-original")) {
            node.parentElement.setAttribute("data-original", node.textContent);
         }

         const original = node.parentElement.getAttribute("data-original");
         node.textContent = checkForCodeInLine(original);
      }
   });
}

export function executeCodeBlocks(variables) {
   console.log("Get's in the function");

   const visibleSteps = [
      ...document.querySelectorAll('[class^="step"]'),
   ].filter((div) => div.style.display !== "none");

   visibleSteps.forEach((step) => {
      const codeBlocks = step.querySelectorAll("div.code");

      codeBlocks.forEach((div) => {
         const userCode = div.textContent.trim();
         if (!userCode) return;

         try {
            const wrappedFunction = new Function(
               ...Object.keys(variables),
               `${userCode}; return { ${Object.keys(variables).join(", ")} };`
            );

            const updatedVariables = wrappedFunction(
               ...Object.values(variables)
            );
            Object.assign(variables, updatedVariables);
         } catch (e) {
            console.warn("Error evaluating code block:", userCode, e);
         }

         div.style.display = "none";
      });
   });

   console.log("Variables after execution:", variables);
}
