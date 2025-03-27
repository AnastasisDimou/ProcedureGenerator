import { parser, variableReader } from "./parser.js";

export async function downloadGeneratedPage(steps, text) {
   // Encode steps and text to ensure proper JSON formatting

   // Base URL for JSDelivr with @latest to always get the latest version

   // Generate script tags using JSDelivr URLs and set them as ES modules
   // Full HTML with externally hosted scripts via JSDelivr
   let variables = variableReader(text);
   let parsedContent = await parser(steps, 0);

   let renderedHTML = "";
   // if (parsedContent[0]) {
   //    renderedHTML = parsedContent[0].outerHTML;
   // }
   console.log("this is the ");
   console.log(parsedContent);
   for (let i = 0; i < parsedContent.length; i++) {
      renderedHTML += parsedContent[i].outerHTML;
   }

   const stepsAsHTML = parsedContent.map((node) => node.outerHTML);

   const variablesScript = `
      <script>
         const variables = ${JSON.stringify(variables)};
         console.log("Variables restored:", variables);
      </script>
   `;

   const inputQuestionsJS = `
   <script>
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
   <script>
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
   <script>
      let stepsHTML = ${JSON.stringify(stepsAsHTML)};
      let currentStep = 0;
      let renderHistory = [];
   
      function renderStepsFromHistory() {
         const container = document.getElementById("website_content");
         container.innerHTML = "";
         renderHistory.forEach(stepHTML => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = stepHTML;
            const stepNode = tempDiv.firstElementChild;
            container.appendChild(stepNode);
         });
         appendNavButtons();
      }
   
      function appendNavButtons() {
         const container = document.getElementById("website_content");
   
         // Clear old buttons
         const oldButtons = container.querySelector('.nav-buttons');
         if (oldButtons) oldButtons.remove();
   
         const buttonContainer = document.createElement("div");
         buttonContainer.classList.add("nav-buttons");
         buttonContainer.style.display = "flex";
         buttonContainer.style.gap = "600px";
         buttonContainer.style.marginTop = "20px";
   
         if (renderHistory.length > 1) {
            const backButton = document.createElement("button");
            backButton.textContent = "Back";
            backButton.addEventListener("click", () => {
               if (renderHistory.length > 1) {
                  renderHistory.pop();
                  currentStep--;
                  renderStepsFromHistory();
               }
            });
            buttonContainer.appendChild(backButton);
         }
   
         if (currentStep < stepsHTML.length - 1) {
            const nextButton = document.createElement("button");
            nextButton.textContent = "Next";
            nextButton.addEventListener("click", () => {
               currentStep++;
               renderHistory.push(stepsHTML[currentStep]);
               renderStepsFromHistory();
            });
            buttonContainer.appendChild(nextButton);
         }
   
         container.appendChild(buttonContainer);
      }
   
      document.addEventListener("DOMContentLoaded", () => {
         // Initial load: render first step
         renderHistory.push(stepsHTML[0]);
         renderStepsFromHistory();
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
      <link rel="stylesheet" href="https://cdn.simplecss.org/simple.css"> <!-- Simple.css -->
   </head>
   <body>
      <div id="website_content">
         ${renderedHTML} <!-- show only the first parsed step statically here -->
      </div>
      ${variablesScript}
      ${inputQuestionsJS}
      ${buttonScript}
   </body>
   </html>`;
   // ${navScript}

   // Create a Blob and generate a download link
   const blob = new Blob([fullHTML], { type: "text/html" });
   const link = document.createElement("a");
   link.href = URL.createObjectURL(blob);
   link.download = "interactive_page.html";
   document.body.appendChild(link);
   link.click();
   document.body.removeChild(link);
}
