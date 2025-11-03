import { markdown } from "./markdown.js";

export function createInputQuestion(
   questionText,
   type,
   variableName,
   callback
) {
   const questionContainer = document.createElement("div");
   questionContainer.innerText = questionText;

   const input = document.createElement("input");
   input.type = type;
   input.name = variableName;

   function handleInput() {
      if (input.value.trim() !== "" && input.checkValidity()) {
         callback(input.value);
         highlightInput();
      }
   }

   function highlightInput() {
      input.style.outline = "2px solid #e64833"; // Outer glow effect
      input.style.border = "2px solid #e64833"; // Solid border
      input.style.backgroundColor = ""; // Ensures background remains unchanged
   }

   input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
         event.preventDefault();
         handleInput();
      }
   });

   input.addEventListener("blur", handleInput);

   questionContainer.appendChild(input);
   return questionContainer;
}

export function createText(text, className) {
   const line = document.createElement("div");
   if (className != "") line.classList.add(className);
   // TODO
   text = markdown(text);
   // nd: a _hacky_ way to allow us to maintain
   // <div ...> ... </div> html code in the source code
   // (by default markdown() escapes html tags; e.g. it converts < and > to &lt; and &gt; )
   text = text
      .replace("&lt;/div&gt;", "</div>")
      .replace(/&lt;div (.*)&gt;/, "<div $1>")
      .replace("<p></div></p>", "</div>")
      .replace(/<p>(<div [^>]*>)<\/p>/, "$1");
   line.innerHTML = text;
   return line;
   // const mainBody = document.getElementById("website_content");
   // mainBody.appendChild(line);
}

let button_id = 0;

export function createMultipleChoiceQuestion(
   questionText,
   options,
   variableName,
   callback
) {
   const questionContainer = document.createElement("div");
   questionContainer.innerText = questionText;
   questionContainer.classList.add("question-block");
   questionContainer.setAttribute("data-var", variableName); // Tag the container with the variable name

   for (let i = 0; i < options.length; i++) {
      const tempButton = document.createElement("button");
      tempButton.id = button_id++;
      tempButton.innerHTML = options[i];
      tempButton.style.marginLeft = "3px";
      questionContainer.appendChild(tempButton);
   }

   const buttons = questionContainer.querySelectorAll("button");
   buttons.forEach((button) => {
      button.addEventListener("click", () => {
         buttons.forEach((btn) => {
            btn.style.backgroundColor = "";
            btn.style.outline = "";
         });

         button.style.backgroundColor = "#e64833";
         button.style.outline = `2px solid #ffffff`;

         callback(button.innerText);
      });
   });
   return questionContainer;
}
