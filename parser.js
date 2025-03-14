import { findBlockEnd } from "./codeExecution.js";
import { runUserCode } from "./codeExecution.js";
import { executeShowIf } from "./codeExecution.js";
import { createText } from "./procedures.js";
import { createInputQuestion } from "./procedures.js";
import { createMultipleChoiceQuestion } from "./procedures.js";
import { renderHistory } from "./renderHistory.js";

let allSteps;
let finished;
let stepContent;
const variables = {};

export function variableReader(textFile) {
   const firstRegex = /\[[a-z_][a-z0-9_]*\]\s*(\([^)]*\))?\s*$/gim;
   const varMatches = Array.from(textFile.matchAll(firstRegex));
   const regexForVar = /\[[a-z_][a-z0-9_]*\]/gi;

   const cleanVar = varMatches.map((match) => {
      return match[0].match(regexForVar)[0].slice(1, -1);
   });

   cleanVar.forEach((varName) => {
      variables[varName] = ""; // Store variables in an object safely
   });
}

export function splitSteps(textFile) {
   // splits the file into stpes based on --- and #
   // const steps = textFile.split(/(?:---|\n# )/);
   const steps = textFile.split(/(?:---)/);

   const stepsArray = steps.map((step) => {
      return step.trim();
   });
   return stepsArray;
}

function questionParsing(line) {
   // One of question
   const regexForMultipleChoice =
      /^(.*?)\[(\w+)\]\s*\(\s*One of:\s*([\w\s,]+)\)$/;

   if (regexForMultipleChoice.test(line)) {
      const str = line.substring(2).trim();
      const regexForSpliting = /^(.*)\[(.*?)\]\s*\(\s*One of:\s*(.*?)\)$/;
      // TODO add no numbers at the start of the variable
      const match = str.match(regexForSpliting);
      // making the array that holds the options
      const questions = match[3].split(",").map((option) => option.trim());
      // console.log("Question:", match[1]);
      if (variables.hasOwnProperty(match[2])) {
         stepContent.appendChild(
            createMultipleChoiceQuestion(match[1], questions, (answer) => {
               variables[match[2]] = answer;
               currentStep++;
            })
         );
      }
   } else {
      // Normal input question
      const str = line.substring(2).trim();
      // regex that splits the question in three parts.
      // The actual question, the variable, and the question type;
      // TODO no numbers at the start of the variable
      const regexForSpliting = /^(.*?)\[(.*?)\]\s*(?:\(([^)]+)\))?$/;

      const match = str.match(regexForSpliting);
      let type = match[3] || "text";

      if (match[2] in variables) {
         type = type.trim();
         stepContent.appendChild(
            createInputQuestion(match[1], type, (answer) => {
               variables[match[2]] = answer;
               currentStep++;
            })
         );
      }
   }
   allSteps++;
}

function checkForCodeInLine(line) {
   const regex = /\{\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\}/g;
   return line.replace(
      regex,
      (_, varName) => variables[varName] ?? `{${varName}}`
   );
}

// Helper to create and await a new "Next" button
function createButtonsAndWait(nextLabel, backLabel, showBack) {
   return new Promise((resolve) => {
      const container = document.getElementById("website_content");
      if (!container) {
         console.error('Element with id "website_content" not found.');
         return;
      }

      // Create a container for the buttons
      const buttonContainer = document.createElement("div");
      buttonContainer.style.display = "flex";
      buttonContainer.style.gap = "600px";
      buttonContainer.style.marginTop = "20px";

      // Create buttons
      const nextButton = document.createElement("button");
      nextButton.textContent = nextLabel;

      const backButton = document.createElement("button");
      backButton.textContent = backLabel;

      // Append buttons to the container
      if (showBack) buttonContainer.appendChild(backButton); // Only append if showBack is true
      buttonContainer.appendChild(nextButton);

      // Append the container to #website_content
      container.appendChild(buttonContainer);

      // Next button event
      nextButton.addEventListener("click", () => {
         cleanup();
         resolve("next"); // Proceed with loop
      });

      // Back button event (only if it exists)
      if (showBack) {
         backButton.addEventListener("click", () => {
            cleanup();
            resolve("back"); // Go back one step
         });
      }

      function cleanup() {
         buttonContainer.remove(); // Remove the entire button container
      }
   });
}

let parsedContent = [];

export async function parser(steps, startIndex) {
   const linesPerStep = steps.map((step) => step.split("\n"));
   const contentContainer = document.getElementById("website_content");
   let end = false;
   let stepNumber = startIndex;

   // variable to save text to append alltogether not line by line
   let savedText = "";
   let boolForAppendingText;

   for (let index = startIndex; index < linesPerStep.length; index++) {
      const step = linesPerStep[index];
      stepContent = document.createElement("div");
      allSteps = 1;
      finished = false;
      boolForAppendingText = false;

      // Process each line
      for (let i = 0; i < step.length; i++) {
         let line = step[i];

         if (line.trim().startsWith("Q:")) {
            savedText = appendText(boolForAppendingText, savedText);
            questionParsing(line);
         } else if (line.trimEnd() === "{") {
            savedText = appendText(boolForAppendingText, savedText);
            let start = i;
            i = findBlockEnd(step, i);
            const userCode = joinToString(step, start, i);
            runUserCode(userCode, variables);
         } else if (/^\{\s*showif/.test(line.trim())) {
            console.log("going in at show if at i = ", i);
            savedText = appendText(boolForAppendingText, savedText);
            const text = joinToArray(step, i, step.length);
            const num = executeShowIf(text, variables, 0, stepContent);
            if (num < 0) {
               end = true;
               break;
            }
            i += num;
         } else if (line.trim().startsWith("{end}")) {
            savedText = appendText(boolForAppendingText, savedText);
            end = true;
            stepContent.appendChild(createText("End of procedure"));
            break;
         } else {
            const regex = /\{\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*\}/g;
            if (line.match(regex)) {
               line = checkForCodeInLine(line);
            }
            if (line) {
               savedText += line + "\n";
               // stepContent.appendChild(createText(line));
               boolForAppendingText = true;
            }
         }
      }

      savedText = appendText(boolForAppendingText, savedText);
      stepContent.appendChild(createText("\n---\n"));
      parsedContent[stepNumber] = stepContent;
      contentContainer.appendChild(stepContent);

      stepContent.scrollIntoView({ behavior: "smooth", block: "start" });

      // Stop if we've reached {end}
      if (end) {
         createFinalBackButton(parsedContent, steps);
         break;
      }

      // If we have more steps, show the "Next" button and wait for click
      if (stepNumber < linesPerStep.length) {
         const showBack = stepNumber > 0; // Only show "Back" if not on the first step
         const action = await createButtonsAndWait("Next", "Back", showBack);

         if (action === "next") {
            stepNumber++; // Move forward
         } else if (action === "back") {
            parsedContent.pop();
            renderHistory(parsedContent, steps);
            break;
         }
      }
   }
}

function createFinalBackButton(parsedContent, steps) {
   const container = document.getElementById("website_content");
   if (!container) {
      console.error('Element with id "website_content" not found.');
      return;
   }

   // Create a back button container
   const buttonContainer = document.createElement("div");
   buttonContainer.style.display = "flex";
   // buttonContainer.style.justifyContent = "center";
   buttonContainer.style.marginTop = "20px";

   // Create Back button
   const backButton = document.createElement("button");
   backButton.textContent = "Back";

   // Append Back button to container
   buttonContainer.appendChild(backButton);
   container.appendChild(buttonContainer);

   // Back button event listener
   backButton.addEventListener("click", () => {
      buttonContainer.remove(); // Remove the final Back button
      parsedContent.pop(); // Remove last rendered step
      renderHistory(parsedContent, steps); // Re-render previous step
   });
}

function parseStep(step) {
   let savedText = "";
   let boolForAppendingText = false;
   let end = false;
   for (let i = 0; i < step.length; i++) {
      let line = step[i];

      if (line.trim().startsWith("Q:")) {
         savedText = appendText(boolForAppendingText, savedText);
         questionParsing(line);
      } else if (line.trimEnd() === "{") {
         savedText = appendText(boolForAppendingText, savedText);
         let start = i;
         i = findBlockEnd(step, i);
         const userCode = joinToString(step, start, i);
         runUserCode(userCode, variables);
      } else if (/^\{\s*showif/.test(line.trim())) {
         console.log("going in at show if at i = ", i);
         savedText = appendText(boolForAppendingText, savedText);
         const text = joinToArray(step, i, step.length);
         const num = executeShowIf(text, variables, 0, stepContent);
         if (num < 0) {
            end = true;
            break;
         }
         i += num;
      } else if (line.trim().startsWith("{end}")) {
         savedText = appendText(boolForAppendingText, savedText);
         end = true;
         stepContent.appendChild(createText("End of procedure"));
         break;
      } else {
         const regex = /\{\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*\}/g;
         if (line.match(regex)) {
            line = checkForCodeInLine(line);
         }
         if (line) {
            savedText += line + "\n";
            // stepContent.appendChild(createText(line));
            boolForAppendingText = true;
         }
      }
   }

   savedText = appendText(boolForAppendingText, savedText);
   stepContent.appendChild(createText("\n---\n"));
   parsedContent[stepNumber] = stepContent;
   contentContainer.appendChild(stepContent);

   if (end) return 0;
}

function appendText(flag, text) {
   if (flag) {
      stepContent.appendChild(createText(text));
      return "";
   }
   return text;
}

// Your existing helper functions:
export function joinToString(step, start, end) {
   return step.slice(start, end + 1).join("\n");
}

export function joinToArray(step, start, end) {
   return step.slice(start, end + 1);
}

// TODO
// whenver generate is hit all variables should be forgotten

// TODO
// make the parser function use the parse step function inside of it.
// It should propably only need to replace everything inside the first loop with the function
