export function initializeInputHandling(variables) {
   function handleInput(input) {
      if (input.value.trim() !== "" && input.checkValidity()) {
         input.style.outline = "2px solid #e64833";
         input.style.border = "2px solid #e64833";

         const key = input.name;
         if (Object.prototype.hasOwnProperty.call(variables, key)) {
            variables[key] = input.value;
            console.log("Updated variables:", variables);
         } else {
            console.log("Skipped input, no variable:", key);
         }
      }
   }

   function enhanceInputs() {
      document.querySelectorAll("input").forEach((input) => {
         input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
               e.preventDefault();
               handleInput(input);
            }
         });
         input.addEventListener("blur", () => handleInput(input));
      });
   }

   // Call immediately to attach listeners
   enhanceInputs();
}
