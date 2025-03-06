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
function createAndWaitForNextButton(container) {
   return new Promise((resolve) => {
      const button = document.createElement("button");
      button.id = "nextButton";
      button.textContent = "Next";
      container.appendChild(button);

      button.addEventListener("click", () => {
         button.remove(); // remove the button from the DOM
         resolve();
      });
   });
}

export async function parser(steps) {
   const linesPerStep = steps.map((step) => step.split("\n"));
   const contentContainer = document.getElementById("website_content");
   const parsedContent = [];
   let end = false;
   let stepNumber = 0;

   for (const step of linesPerStep) {
      // Create a container for this step
      stepContent = document.createElement("div");
      allSteps = 1;
      finished = false;

      // Process each line
      for (let i = 0; i < step.length; i++) {
         let line = step[i];

         if (line.trim().startsWith("Q:")) {
            questionParsing(line);
         } else if (line.trimEnd() === "{") {
            let start = i;
            i = findBlockEnd(step, i);
            const userCode = joinToString(step, start, i);
            runUserCode(userCode, variables);
         } else if (/^\{\s*showif/.test(line.trim())) {
            const num = executeShowIf(step, variables, i, stepContent, i);
            if (num < 0) {
               end = true;
               break;
            }
            i += num;
         } else if (line.trim().startsWith("{end}")) {
            end = true;
            stepContent.appendChild(createText("End of procedure"));
            break;
         } else {
            const regex = /\{\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*\}/g;
            if (line.match(regex)) {
               line = checkForCodeInLine(line);
            }
            if (line) {
               stepContent.appendChild(createText(line));
            }
         }
      }

      stepContent.appendChild(createText("\n---\n"));
      parsedContent[stepNumber] = stepContent;
      contentContainer.appendChild(stepContent);
      stepNumber++;

      // Stop if we've reached {end}
      if (end) break;

      // If we have more steps, show the "Next" button and wait for click
      if (stepNumber < linesPerStep.length) {
         await createAndWaitForNextButton(contentContainer);
      }
   }

   return parsedContent;
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
