import { parseSection } from "./parser.js";
import { createText } from "./procedures.js";

export function findBlockEnd(text, startIndex) {
   // startIndex = 0;
   let braceCount = 0;
   let inString = false;
   let stringChar = "";
   let foundOpening = false;

   // console.log("The text is: ");
   // console.log(text);

   // console.log("it starts at ", text[startIndex]);
   for (let i = startIndex; i < text.length; i++) {
      const chunk = text[i];
      let j = 0;
      while (j < chunk.length) {
         const c = chunk[j];
         const next = chunk[j + 1] || "";

         // Skip single-line comments
         if (c === "/" && next === "/") break;

         // Skip multi-line comments
         if (c === "/" && next === "*") {
            j += 2;
            while (
               j < chunk.length - 1 &&
               !(chunk[j] === "*" && chunk[j + 1] === "/")
            )
               j++;
            j += 2;
            continue;
         }

         // Handle entering/exiting string literals
         if (!inString && (c === '"' || c === "'")) {
            if (j > 0 && /\w/.test(chunk[j - 1])) {
               // If the previous character is a word character, it's not a string start (e.g., It's)
            } else {
               inString = true;
               stringChar = c;
            }
         } else if (inString && c === stringChar) {
            inString = false;
         }

         // Ignore braces inside strings
         if (inString) {
            j++;
            continue;
         }

         // Track braces
         if (c === "{") {
            foundOpening = true;
            braceCount++;
         } else if (c === "}" && foundOpening) {
            braceCount--;
            if (braceCount === 0) return i;
         }

         j++;
      }
   }

   throw new Error("Unmatched closing brace '}' not found.");
}

function extractVariablesAndCleanCode(userCode, variables) {
   const varRegex =
      /^(var|let|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)(?:\s*=\s*([^;\n]+))?\s*;?\s*$/m;

   let lines = userCode.split("\n");

   for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trimStart();
      let match = line.match(varRegex);

      if (match) {
         const [, , varName, value] = match;
         variables[varName] = value ? value.trim() : undefined;

         // Replace with assignment or standalone variable reference
         lines[i] =
            value !== undefined
               ? `${varName} = ${value.trim()};`
               : `${varName};`;
      }
   }

   let cleanedCode = lines.filter((line) => line.trim() !== "").join("\n");

   for (const varName in variables) {
      if (variables[varName] !== undefined) {
         variables[varName] = computeVariable(varName, variables);
      }
   }

   return cleanedCode;
}

function computeVariable(varName, variables) {
   let expression = variables[varName];

   if (/["']/.test(expression)) {
      expression = expression.replace(/["']/g, "");
   }

   // If variable is undefined, empty, or only whitespace, return undefined
   // if (expression === undefined || expression.trim() === "") return undefined;

   // expression = expression.replace(/,$/, "").trim(); // Remove trailing commas

   // Handle empty quoted strings as undefined
   // if (/^["'].*["']$/.test(expression)) {
   //    const unquoted = expression.slice(1, -1).trim();
   //    if (unquoted === "") return undefined; // Treat empty strings as undefined
   //    return unquoted;
   // }

   // If the expression is purely numeric, convert it to a number
   if (!isNaN(expression) && !isNaN(parseFloat(expression))) {
      return parseFloat(expression);
   }

   // Ensure the expression does not contain unsafe characters
   // if (!/^[\w\s+\-*/().]+$/.test(expression)) return undefined;

   // Safely evaluate the expression with only the provided variables
   // return new Function(...Object.keys(variables), `return (${expression});`)(
   //    ...Object.values(variables)
   // );
   return expression;
}

export function runUserCode(userCode, variables, userCodeContainer) {
   userCode = extractVariablesAndCleanCode(userCode, variables);
   console.log("The cleaned code is: ");
   console.log(userCode);
   const lines = userCode.split("\n");
   if (lines[0].trim() === "{") lines.shift();
   if (lines[lines.length - 1].trim() === "}") lines.pop();
   const cleaned = lines.join("\n");
   userCodeContainer.appendChild(createText(cleaned, ""));

   // Wrap user code in a function that returns the modified variables object
   const wrappedFunction = new Function(
      ...Object.keys(variables),
      `${userCode}; return { ${Object.keys(variables).join(", ")} };`
   );

   // Execute function and capture returned variables
   const updatedVariables = wrappedFunction(...Object.values(variables));

   // Update original variables object
   Object.assign(variables, updatedVariables);
   return userCode;
}

export function executeShowIf(
   ifCode,
   variables,
   startIndex,
   end,
   stepContent,
   stepNumber,
   globalIndex
) {
   // TODO
   // check for how many = are in the if statement to be sure

   // const code = joinToArray(ifCode, startIndex, end);
   let code = ifCode;
   const regexForDeleting = /showif|\{|\}/g;
   // const regexForEnd = /\{end\}/;

   let i;
   for (i = startIndex; i < end; i++) {
      console.log("I is: ", i);
      console.log("startIndex is: ", startIndex);
      if (i === startIndex) {
         code[i] = code[i].replace(regexForDeleting, "");

         // create the fucntion that returns if the condition is true
         const evaluate = new Function(
            ...Object.keys(variables),
            `try { return ${code[i]}; } catch (error) { if (error instanceof ReferenceError) return true; throw error; }`
         );
         // get the result
         const result = evaluate(...Object.values(variables));
         if (result) {
            continue;
         } else {
            i = end;
            break;
         }
      } else {
         // code[0] = `{${code[0]}`;
         const res = parseSection(
            code,
            stepContent,
            stepNumber,
            i + globalIndex - 1
         );
         if (res === 0) {
            return -1;
         }
         i = res;
      }
   }
   return i - 1;
}

// TODO
// Every time an if statement is true a step is going to be created until the next showif (maybe with regex by finding the index of the next showif) and calling the parseStep function on that step. The rest of the code should propably not change
