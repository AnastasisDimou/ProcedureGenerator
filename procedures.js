import { markdown } from "./markdown.js";

// function that makes the objects
function focusNextQuestion() {
   if (allSteps > currentStep) {
      const questions = document.getElementById("website_content").children;
      // TODO the making of the array should be it's own function
      const focusableElements = [];
      let index = 0;
      for (let i = 0; i < questions.length; i++) {
         if (questions[i].querySelector("input, button")) {
            focusableElements[index] =
               questions[i].querySelector("input, button");
            index++;
         }
      }
      console.log(focusableElements);
      console.log(currentStep);
      focusableElements[currentStep].focus();
   }
}

export function createInputQuestion(questionText, type, callback) {
   const questionContainer = document.createElement("div");
   questionContainer.innerText = questionText;
   const input = document.createElement("input");
   input.type = type;
   input.addEventListener("keydown", function (event) {
      if (
         event.key === "Enter" &&
         input.value.trim() !== "" &&
         input.checkValidity()
      ) {
         event.preventDefault();
         const inputValue = input.value;
         callback(inputValue);
         focusNextQuestion();
      }
   });

   questionContainer.appendChild(input);
   return questionContainer;
}

export function createText(text) {
   const line = document.createElement("div");
   // TODO
   //console.log("Source is:", text);
   text = markdown(text);
   // nd: a _hacky_ way to allow us to maintain
   // <div ...> ... </div> html code in the source code
   // (by default markdown() escapes html tags; e.g. it converts < and > to &lt; and &gt; )
   text = text
      .replace("&lt;/div&gt;", "</div>")
      .replace(/&lt;div (.*)&gt;/, "<div $1>")
      .replace("<p></div></p>", "</div>")
      .replace(/<p>(<div [^>]*>)<\/p>/, "$1");
   //console.log("----------------"); console.log("Restored div text is:"); console.log(text); console.log("----------------")
   line.innerHTML = text;
   return line;
   // const mainBody = document.getElementById("website_content");
   // mainBody.appendChild(line);
}

let button_id = 0;

export function createMultipleChoiceQuestion(questionText, options, callback) {
   // finished = false;
   const questionContainer = document.createElement("div");
   questionContainer.innerText = questionText;

   for (let i = 0; i < options.length; i++) {
      const tempButton = document.createElement("button");
      tempButton.id = button_id++;
      console.log("Button id is: " + button_id);
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

         // change button color when clicked
         button.style.backgroundColor = "#e64833";
         button.style.outline = `2px solid #ffffff`;

         callback(button.innerText);
         // focusNextQuestion();?
      });
   });
   return questionContainer;
   // document
   //    .getElementById("website_content")
   //    .appendChild(questionContainer);
}

function answerYes(answerText) {
   const answerContainer = document.createElement("div");
   answerContainer.innerHTML = `
<p>${answerText}</p>
`;
   // answer.appendChild(answerContainer);
   document.getElementById("website_content").appendChild(answerContainer);
}

function answerNo(answerText) {
   const answerContainer = document.createElement("div");
   if (answerText != "") {
      answerContainer.innerHTML = `
<p>${answerText}</p>
`;
      document.getElementById("website_content").appendChild(answerContainer);
   }
}

function createYesOrNoQuestion(yesText, noText, callback) {
   finished = false;
   const questionContainer = document.createElement("div");
   questionContainer.innerHTML = `
<p>${questionText}
<button>YES</button>
<button>NO</button>
</p>
`;
   const buttons = questionContainer.querySelectorAll("button");
   buttons[0].onclick = () => {
      answerYes(yesText);
      callback();
   };
   buttons[1].onclick = () => {
      answerNo(noText);
      callback();
   };
   document.getElementById("website_content").appendChild(questionContainer);
}
