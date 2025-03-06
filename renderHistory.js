import { parser } from "./parser.js";

export function renderHistory(parsedContent, stepNumber) {
   const container = document.getElementById("website_content");
   for (let i = 0; i < stepNumber; i++) {
      container.appendChild(parsedContent[i]);
   }
}
