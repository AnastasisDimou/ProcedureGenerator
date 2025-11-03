import { parser } from "./parser.js";

export function renderHistory(parsedContent, steps) {
   console.log("Step number is:", parsedContent.length);
   console.log(parsedContent);
   const container = document.getElementById("website_content");
   container.innerHTML = "";

   for (let i = 0; i < parsedContent.length; i++) {
      container.appendChild(parsedContent[i]);
   }

   // Create a container for buttons
   const buttonContainer = document.createElement("div");
   buttonContainer.style.display = "flex";
   buttonContainer.style.gap = "600px";
   buttonContainer.style.marginTop = "20px";

   // Create the Next button
   const nextButton = document.createElement("button");
   nextButton.textContent = "Next";

   nextButton.addEventListener("click", () => {
      buttonContainer.remove(); // Remove buttons before rendering new step
      parser(steps, parsedContent.length);
   });

   // Create the Back button (only if stepNumber > 0)
   if (parsedContent.length > 1) {
      const backButton = document.createElement("button");
      backButton.textContent = "Back";

      backButton.addEventListener("click", () => {
         buttonContainer.remove(); // Remove buttons before rendering previous step
         parsedContent.pop();
         renderHistory(parsedContent, steps);
      });

      buttonContainer.appendChild(backButton); // Add Back button first
   }

   buttonContainer.appendChild(nextButton); // Add Next button

   container.appendChild(buttonContainer);
}
