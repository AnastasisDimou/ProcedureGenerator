import { findBlockEnd } from "./codeExecution.js";
import { runUserCode } from "./codeExecution.js";
import { createText } from "./procedures.js";
import { createInputQuestion } from "./procedures.js";
import { createMultipleChoiceQuestion } from "./procedures.js";
import { renderHistory } from "./renderHistory.js";

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

   return variables;
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

function questionParsing(line, container) {
   const regexForMultipleChoice =
      /^(.*?)\[(\w+)\]\s*\(\s*One of:\s*([\w\s,]+)\)$/;

   if (regexForMultipleChoice.test(line)) {
      const str = line.substring(2).trim();
      const regexForSpliting = /^(.*)\[(.*?)\]\s*\(\s*One of:\s*(.*?)\)$/;
      const match = str.match(regexForSpliting);
      const questions = match[3].split(",").map((option) => option.trim());

      if (match[2] in variables) {
         container.appendChild(
            createMultipleChoiceQuestion(
               match[1],
               questions,
               match[2],
               (answer) => {
                  variables[match[2]] = answer;
                  currentStep++;
               }
            )
         );
      }
   } else {
      const str = line.substring(2).trim();
      const regexForSpliting = /^(.*?)\[(.*?)\]\s*(?:\(([^)]+)\))?$/;
      const match = str.match(regexForSpliting);
      let type = match[3] || "text";

      if (match[2] in variables) {
         type = type.trim();
         container.appendChild(
            createInputQuestion(match[1], type, match[2], (answer) => {
               variables[match[2]] = answer;
               currentStep++;
            })
         );
      }
   }
   allSteps++;
}

export function constVariableReader(textFile) {
   const constVars = {};

   // Matches: [varname] const: <html content>
   const constRegex = /^\[([a-z_][a-z0-9_]*)]\s+const:\s*(.+)$/gim;

   let match;
   while ((match = constRegex.exec(textFile)) !== null) {
      const varName = match[1];
      const value = match[2].trim();
      constVars[varName] = value;
   }

   console.log(constVars);
   return constVars;
}

let parsedContent = [];

export async function parser(steps, startIndex, textFile) {
   let constVars = constVariableReader(textFile);
   const linesPerStep = steps.map((step) => step.split("\n"));
   const contentContainer = document.getElementById("website_content");
   parsedContent = []; // clear it

   for (let index = startIndex; index < linesPerStep.length; index++) {
      const step = linesPerStep[index];
      allSteps = 1;
      finished = false;

      const res = parseSection(step, index, 0, contentContainer, constVars);
      if (res === 0) {
         createFinalBackButton(parsedContent, steps);
         break;
      }
   }

   // Save everything that was appended to website_content
   parsedContent[0] = Array.from(contentContainer.children);

   contentContainer.innerHTML = ""; // prevents double inclusion

   return parsedContent;
}

function classifyLine(line) {
   const trimmed = line.trim();
   if (trimmed.startsWith("Q:")) return "question";
   if (trimmed === "{") return "codeblock_start";
   if (/^\{\s*showif/.test(trimmed)) return "showif_start";
   if (trimmed.startsWith("{end}")) return "end";
   if (trimmed === "---") return "separator";
   if (trimmed === "}") return "block_end";
   return "text";
}

function replaceConstVars(text, constVars) {
   return text.replace(/\{const\s+([a-z_][a-z0-9_]*)}/gi, (match, varName) => {
      if (constVars[varName] !== undefined) {
         console.log(
            `[constVar] Replacing {const ${varName}} with:`,
            constVars[varName]
         );
         return constVars[varName];
      } else {
         console.warn(`[constVar] No match found for: {const ${varName}}`);
         return match;
      }
   });
}

export function parseSection(
   step,
   stepNumber,
   start,
   contentContainer,
   constVars
) {
   let savedText = "";
   let boolForAppendingText = false;
   let end = false;
   let i;

   for (i = start; i < step.length; i++) {
      let line = step[i];
      const type = classifyLine(line);

      switch (type) {
         case "question": {
            savedText = appendText(
               boolForAppendingText,
               savedText,
               contentContainer
            );
            questionParsing(line, contentContainer);
            boolForAppendingText = false;
            break;
         }
         case "codeblock_start": {
            savedText = appendText(
               boolForAppendingText,
               savedText,
               contentContainer
            );
            const codeStart = i;
            i = findBlockEnd(step, codeStart);
            const userCode = joinToString(step, codeStart, i);
            const codeContainer = document.createElement("div");
            codeContainer.classList.add("code");
            const cleanCode = runUserCode(userCode, variables, codeContainer);
            console.log("Cleaned code is: ");
            console.log(cleanCode);
            codeContainer.textContent = cleanCode;
            console.log(codeContainer.innerHTML);
            contentContainer.appendChild(codeContainer);
            boolForAppendingText = false;
            break;
         }
         case "showif_start": {
            savedText = appendText(
               boolForAppendingText,
               savedText,
               contentContainer
            );
            const showIfContainer = document.createElement("div");
            showIfContainer.classList.add("if");
            i = createShowif(i, step, contentContainer);
            contentContainer.appendChild(showIfContainer);
            boolForAppendingText = false;
            break;
         }
         case "end": {
            savedText = appendText(
               boolForAppendingText,
               savedText,
               contentContainer
            );
            contentContainer.appendChild(createText("End of procedure", ""));
            end = true;
            break;
         }
         case "separator": {
            savedText = appendText(
               boolForAppendingText,
               savedText,
               contentContainer
            );
            const sep = document.createElement("div");
            sep.classList.add("line-separator");
            sep.setAttribute("data-step-index", stepNumber++);
            contentContainer.appendChild(sep);
            savedText = "";
            boolForAppendingText = false;
            break;
         }
         case "text": {
            line = replaceConstVars(line.trim(), constVars);
            if (line.trim() !== "}") {
               savedText += line + "\n";
               boolForAppendingText = true;
            }
            break;
         }
      }

      if (end) break;
   }

   savedText = appendText(boolForAppendingText, savedText, contentContainer);
   return end ? 0 : i;
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

function createShowif(i, step, contentContainer) {
   const end = findBlockEnd(step, i);
   const regexForDeleting = /showif|\{|\}/g;
   step[i] = step[i].replace(regexForDeleting, "");
   const firstLine = step[i].trim();

   let showIfContainer = document.createElement("div");
   showIfContainer.classList.add("if");
   showIfContainer.setAttribute("data-expression", firstLine);

   let innerContainer = document.createElement("div");
   showIfContainer.appendChild(innerContainer);

   let savedText = "";
   let boolForAppendingText = false;

   for (; i < end; i++) {
      const line = step[i];
      const type = classifyLine(line);

      switch (type) {
         case "showif_start": {
            savedText = appendText(
               boolForAppendingText,
               savedText,
               innerContainer
            );
            i = createShowif(i, step, innerContainer); // recursive
            boolForAppendingText = false;
            break;
         }
         case "question": {
            savedText = appendText(
               boolForAppendingText,
               savedText,
               innerContainer
            );
            questionParsing(line, innerContainer);
            boolForAppendingText = false;
            break;
         }
         case "codeblock_start": {
            savedText = appendText(
               boolForAppendingText,
               savedText,
               innerContainer
            );
            const codeStart = i;
            i = findBlockEnd(step, codeStart);
            const userCode = joinToString(step, codeStart, i);
            const codeContainer = document.createElement("div");
            codeContainer.classList.add("code");
            const cleanCode = runUserCode(userCode, variables, codeContainer);
            codeContainer.innerHTML = cleanCode;
            innerContainer.appendChild(codeContainer);
            boolForAppendingText = false;
            break;
         }
         case "separator": {
            savedText = appendText(
               boolForAppendingText,
               savedText,
               innerContainer
            );
            contentContainer.appendChild(showIfContainer);

            const sep = document.createElement("div");
            sep.classList.add("line-separator");
            contentContainer.appendChild(sep);

            // start new showIf block with same expression
            showIfContainer = document.createElement("div");
            showIfContainer.classList.add("if");
            showIfContainer.setAttribute("data-expression", firstLine);

            innerContainer = document.createElement("div");
            showIfContainer.appendChild(innerContainer);

            boolForAppendingText = false;
            break;
         }
         case "end": {
            savedText = appendText(
               boolForAppendingText,
               savedText,
               innerContainer
            );
            innerContainer.appendChild(createText("End of procedure", ""));
            contentContainer.appendChild(showIfContainer);
            return -1;
         }
         case "text": {
            if (line.trim() !== "}" && line.trim() !== firstLine) {
               savedText += line + "\n";
               boolForAppendingText = true;
            }
            break;
         }
      }
   }

   savedText = appendText(boolForAppendingText, savedText, innerContainer);
   contentContainer.appendChild(showIfContainer);
   return i;
}

function appendText(flag, text, container = stepContent) {
   if (flag) {
      container.appendChild(createText(text.trim(), ""));
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
