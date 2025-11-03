function renderSteps(parsedContent, stepNumber) {
   console.log("Step number is: " + stepNumber);
   console.log(parsedContent[stepNumber]);
   // create the step
   const container = document.getElementById("website_content");
   container.innerHTML = "";
   container.appendChild(parsedContent[stepNumber]);
   // create next and back buttons
   const buttonContainer = document.createElement("div");
   buttonContainer.style.display = "flex";
   buttonContainer.style.gap = "600px";
   let backButton;
   let button;
   if (stepNumber != 0) {
      backButton = document.createElement("button");
      backButton.innerText = "BACK";
      backButton.addEventListener("click", () => {
         backButton.remove();
         if (button) {
            button.remove();
         }
         stepNumber--;
         renderSteps(parsedContent, stepNumber);
      });
      buttonContainer.appendChild(backButton);
   }
   if (stepNumber + 1 in parsedContent) {
      button = document.createElement("button");
      button.innerText = "NEXT";
      button.addEventListener("click", () => {
         button.remove();
         stepNumber++;
         if (backButton) {
            backButton.remove();
         }
         renderSteps(parsedContent, stepNumber);
      });
      buttonContainer.appendChild(button);
   }
   container.appendChild(buttonContainer);
}
