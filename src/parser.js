import { findBlockEnd } from "./codeExecution.js";
import { runUserCode } from "./codeExecution.js";
import { createText } from "./procedures.js";
import { createInputQuestion } from "./procedures.js";
import { createMultipleChoiceQuestion } from "./procedures.js";
import { renderHistory } from "./renderHistory.js";

let stepContent;
const variables = {};

// NEW: per-step RepeatStep conditions
const repeatStepConditions = {}; // key: stepNumber, value: expression string

// Map from DSL key to CSS class
const STYLE_MAP = {
   warning_style: "warning-styling",
   error_style: "error-styling",
   info_style: "info-styling",
   success_style: "success-styling",
};

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
   const rawSteps = textFile.split(/(?:---)/);
   const stepsArray = [];

   for (const rawStep of rawSteps) {
      const step = rawStep.trim();
      if (!step) continue; // skip empty

      // skip steps that contain Variables[]
      if (/variables\[\]\s*:?/i.test(step)) {
         continue;
      }

      stepsArray.push(step);
   }
   return stepsArray;
}

function questionParsing(line, container) {
   const regexForMultipleChoice =
      /^(.*?)\[(\w+)\]\s*\(\s*One of:\s*([\w\s,]+)\)$/;

   // Normalize line: strip indentation, then strip "Q:" prefix
   const trimmed = line.trim();
   const str = trimmed.replace(/^Q:\s*/i, ""); // remove leading "Q:" or "q:"

   // Multiple choice?
   if (regexForMultipleChoice.test(str)) {
      const regexForSpliting = /^(.*)\[(.*?)\]\s*\(\s*One of:\s*(.*?)\)$/;
      const match = str.match(regexForSpliting);
      if (!match) {
         console.warn("[questionParsing] MCQ line did not match:", str);
         return;
      }

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
      // Normal input question
      const regexForSpliting = /^(.*?)\[(.*?)\]\s*(?:\(([^)]+)\))?$/;
      const match = str.match(regexForSpliting);
      if (!match) {
         console.warn("[questionParsing] Question line did not match:", str);
         return;
      }

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

   return constVars;
}

let parsedContent = [];

export async function parser(steps, startIndex, textFile) {
   let constVars = constVariableReader(textFile);
   const linesPerStep = steps.map((step) => step.split("\n"));
   const contentContainer = document.getElementById("website_content");
   parsedContent = [];

   // Clear previous RepeatStep conditions
   for (const key in repeatStepConditions) {
      delete repeatStepConditions[key];
   }

   for (let index = startIndex; index < linesPerStep.length; index++) {
      const step = linesPerStep[index];
      allSteps = 1;
      finished = false;

      const res = parseSection(step, index, 0, contentContainer, constVars);

      // If parseSection signals global end (res === 0), stop.
      if (res === 0) {
         createFinalBackButton(parsedContent, steps);
         break;
      }

      const isLastStep = index === linesPerStep.length - 1;
      if (!isLastStep) {
         const sep = document.createElement("div");
         sep.classList.add("line-separator");
         sep.setAttribute("data-step-index", index);
         contentContainer.appendChild(sep);
      }
   }

   parsedContent[0] = Array.from(contentContainer.children);
   contentContainer.innerHTML = "";
   return parsedContent;
}

function classifyLine(line) {
   const trimmed = line.trim();
   if (trimmed.startsWith("Q:")) return "question";

   // Step-level repeat directive
   if (/^\{\s*RepeatStep\b/i.test(trimmed)) return "repeat_step_header";

   if (trimmed === "{") return "codeblock_start";
   if (/^\{\s*showif/.test(trimmed)) return "showif_start";
   if (trimmed.startsWith("{end}")) return "end";
   if (trimmed === "---") return "separator";
   if (trimmed === "}") return "block_end";
   if (
      /^\[(warning_style|error_style|info_style|success_style)\]/i.test(trimmed)
   )
      return "styled_text";
   return "text";
}

function replaceConstVars(text, constVars) {
   return text.replace(/\{const\s+([a-z_][a-z0-9_]*)}/gi, (match, varName) => {
      if (constVars[varName] !== undefined) {
         return constVars[varName];
      } else {
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
            codeContainer.textContent = cleanCode;
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
            i = createShowif(i, step, contentContainer);
            boolForAppendingText = false;
            break;
         }
         case "repeat_step_header": {
            // Parse header, store per-step condition, render nothing
            let header = line.trim(); // e.g. "{RepeatStep Until last_server == \"Yes\"}"

            if (header.startsWith("{")) {
               header = header.slice(1).trim();
            }
            if (header.endsWith("}")) {
               header = header.slice(0, -1).trim();
            }

            const lower = header.toLowerCase();
            const untilIndex = lower.indexOf("until");
            if (untilIndex === -1) {
               console.warn(
                  "[repeat_step_header] No 'Until' found in header:",
                  header
               );
               break;
            }

            let conditionRaw = header.slice(untilIndex + "until".length).trim();
            if (!conditionRaw) {
               console.warn(
                  "[repeat_step_header] Empty condition in header:",
                  header
               );
               break;
            }

            const expression = normalizeShowIfExpression(conditionRaw);
            repeatStepConditions[stepNumber] = expression;
            break;
         }
         case "styled_text": {
            savedText = appendText(
               boolForAppendingText,
               savedText,
               contentContainer
            );
            boolForAppendingText = false;

            const trimmed = line.trim();
            const match = trimmed.match(/^\[([a-z_]+)\]\s*(.*)$/i);
            if (!match) {
               console.warn("[styled_text] Could not parse line:", line);
               break;
            }

            const styleKey = match[1].toLowerCase();
            let textPart = match[2] || "";
            textPart = replaceConstVars(textPart, constVars);

            const p = document.createElement("p");
            p.classList.add("block-styling");

            const cssClass = STYLE_MAP[styleKey];
            if (cssClass) {
               p.classList.add(cssClass);
            } else {
               console.warn("[styled_text] Unknown style key:", styleKey);
            }

            p.textContent = textPart;
            contentContainer.appendChild(p);
            break;
         }
         case "end": {
            savedText = appendText(
               boolForAppendingText,
               savedText,
               contentContainer
            );
            const endMarker = document.createElement("div");
            endMarker.classList.add("end");
            contentContainer.appendChild(endMarker);
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
               appendText(true, line.trim(), contentContainer);
            }
            break;
         }
      }

      if (end) break;
   }

   // You had this commented out; leaving it as-is:
   // savedText = appendText(boolForAppendingText, savedText, contentContainer);
   return end ? 0 : i;
}

function createFinalBackButton(parsedContent, steps) {
   const container = document.getElementById("website_content");
   if (!container) {
      console.error('Element with id "website_content" not found.');
      return;
   }

   const buttonContainer = document.createElement("div");
   buttonContainer.style.display = "flex";
   buttonContainer.style.marginTop = "20px";

   const backButton = document.createElement("button");
   backButton.textContent = "Back";

   buttonContainer.appendChild(backButton);
   container.appendChild(buttonContainer);

   backButton.addEventListener("click", () => {
      buttonContainer.remove();
      parsedContent.pop();
      renderHistory(parsedContent, steps);
   });
}

function createShowif(i, step, contentContainer) {
   const originalLine = step[i];
   const trimmed = originalLine.trim();

   if (/\{.*\}/.test(trimmed) && trimmed.includes("showif")) {
      console.warn(
         `[WARNING] ShowIf block starts and ends on same line (${i}): "${trimmed}"`
      );
      const idx = originalLine.lastIndexOf("}");
      if (idx !== -1) {
         step[i] = originalLine.slice(0, idx) + originalLine.slice(idx + 1);
      }
   }

   const end = findBlockEnd(step, i);
   const regexForDeleting = /showif|\{|\}/g;
   step[i] = step[i].replace(regexForDeleting, "");
   const firstLine = step[i].trim(); // original DSL
   const expression = normalizeShowIfExpression(firstLine); // JS expression

   let showIfContainer = document.createElement("div");
   showIfContainer.classList.add("if");
   showIfContainer.setAttribute("data-expression", expression);

   let innerContainer = document.createElement("div");
   innerContainer.classList.add("if-inner");
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

            showIfContainer = document.createElement("div");
            showIfContainer.classList.add("if");
            showIfContainer.setAttribute("data-expression", expression);

            innerContainer = document.createElement("div");
            showIfContainer.appendChild(innerContainer);

            boolForAppendingText = false;
            break;
         }
         case "styled_text": {
            savedText = appendText(
               boolForAppendingText,
               savedText,
               innerContainer
            );
            boolForAppendingText = false;

            const trimmedLine = line.trim();
            const match = trimmedLine.match(/^\[([a-z_]+)\]\s*(.*)$/i);
            if (!match) {
               console.warn("[styled_text] Could not parse showif line:", line);
               break;
            }

            const styleKey = match[1].toLowerCase();
            const textPart = match[2] || "";

            const p = document.createElement("p");
            p.classList.add("block-styling");
            const cssClass = STYLE_MAP[styleKey];
            if (cssClass) {
               p.classList.add(cssClass);
            } else {
               console.warn(
                  "[styled_text] Unknown style key in showif:",
                  styleKey
               );
            }
            p.textContent = textPart;
            innerContainer.appendChild(p);
            break;
         }
         case "end": {
            savedText = appendText(
               boolForAppendingText,
               savedText,
               innerContainer
            );
            const endMarker = document.createElement("div");
            endMarker.classList.add("end");
            innerContainer.appendChild(endMarker);
            contentContainer.appendChild(showIfContainer);
            break;
         }
         case "text": {
            if (line.trim() !== "}" && line.trim() !== firstLine) {
               appendText(true, line.trim(), innerContainer);
            }
            break;
         }
      }
   }
   savedText = appendText(boolForAppendingText, savedText, innerContainer);
   contentContainer.appendChild(showIfContainer);
   return i;
}

function normalizeShowIfExpression(expr) {
   const equalsMatches = expr.match(/=/g) || [];
   if (equalsMatches.length !== 1) return expr;

   if (/==/.test(expr) || /[!<>]=/.test(expr)) return expr;

   return expr.replace("=", "==");
}

function appendText(flag, text, container) {
   const trimmed = text.trim();

   if (flag || trimmed === "") {
      container.appendChild(createText(trimmed, ""));
      return "";
   }
   return text;
}

export function joinToString(step, start, end) {
   return step.slice(start, end + 1).join("\n");
}

export function joinToArray(step, start, end) {
   return step.slice(start, end + 1);
}

// NEW: expose the per-step repeat conditions to initialize.js
export function getRepeatStepConditions() {
   return repeatStepConditions;
}
