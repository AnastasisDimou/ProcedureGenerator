// downloadPage.js
import {
   parser,
   variableReader,
   splitSteps,
   getRepeatStepConditions,
} from "./parser.js";

export async function downloadGeneratedPage(text) {
   // 1) Extract variables from the text (same as generateProcedure)
   const variables = variableReader(text);

   // 2) Split into logical steps
   const steps = splitSteps(text);

   // 3) Parse DSL into DOM nodes
   const tempContainer = document.createElement("div");
   const parsedContent = await parser(steps, 0, text, tempContainer);

   // 4) Get per-step RepeatStep conditions from parser
   const repeatStepConditions = getRepeatStepConditions();

   const tempDoc = document.implementation.createHTMLDocument("procedure");
   const nodes = parsedContent[0] || [];

   function wrapStep(elements, stepIndex) {
      const stepDiv = tempDoc.createElement("div");
      stepDiv.classList.add("step" + stepIndex);

      // Attach RepeatStep condition if present
      if (
         repeatStepConditions &&
         Object.prototype.hasOwnProperty.call(repeatStepConditions, stepIndex)
      ) {
         stepDiv.setAttribute(
            "data-repeat-step-until",
            repeatStepConditions[stepIndex]
         );
      }

      elements.forEach((el) => stepDiv.appendChild(el.cloneNode(true)));

      const nav = tempDoc.createElement("div");
      nav.classList.add("nav-buttons");
      stepDiv.appendChild(nav);

      return stepDiv.outerHTML;
   }

   // 5) Build renderedHTML just like appendParsedSteps, but into a string
   let renderedHTML = "";
   let currentStep = [];
   let stepCounter = 0;

   function flushStep() {
      if (!currentStep.length) return;
      renderedHTML += wrapStep(currentStep, stepCounter);
      stepCounter++;
      currentStep = [];
   }

   nodes.forEach((el) => {
      if (el.classList.contains("line-separator")) {
         flushStep();
      } else {
         currentStep.push(el);
      }
   });

   flushStep(); // flush remaining

   // 6) Inline runtime script (proceduresRuntime + RepeatStep)
   const serializedVars = JSON.stringify(variables).replace(/<\//g, "<\\/");

   const runtimeScript = `
<script>
  const variables = ${serializedVars};
  console.log("Variables restored:", variables);

  function initializeInputHandling(variables) {
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
      document.querySelectorAll("input").forEach(function (input) {
        input.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            handleInput(input);
          }
        });
        input.addEventListener("blur", function () {
          handleInput(input);
        });
      });
    }

    enhanceInputs();
  }

  function initializeQuestionButtons(variables) {
    const containers = document.querySelectorAll("#website_content .question-block");

    containers.forEach(function (container) {
      const key = container.getAttribute("data-var");
      if (!key) return;

      container.addEventListener("click", function (e) {
        const clickedButton = e.target.closest("button");
        if (!clickedButton) return;
        if (!Object.prototype.hasOwnProperty.call(variables, key)) return;

        const allButtons = container.querySelectorAll("button");
        allButtons.forEach(function (btn) {
          btn.style.backgroundColor = "";
          btn.style.outline = "";
        });

        clickedButton.style.backgroundColor = "#e64833";
        clickedButton.style.outline = "2px solid #ffffff";
        variables[key] = clickedButton.innerText;
        console.log("Updated variable " + key + ":", variables[key]);
      });
    });
  }

  function initializeNavigation(options) {
    const executeAllCodeBlocks = options.executeAllCodeBlocks;
    const updateInlineVariables = options.updateInlineVariables;
    const evaluateConditions = options.evaluateConditions;

    let currentStep = 0;
    const visitedSteps = [0];

    function getTotalSteps() {
      return document.querySelectorAll('[class^="step"]').length;
    }

    function initializePage() {
      const totalSteps = getTotalSteps();
      for (let i = 0; i < totalSteps; i++) {
        const step = document.querySelector(".step" + i);
        if (step) step.style.display = i === 0 ? "block" : "none";
      }

      executeAllCodeBlocks();
      updateInlineVariables();
      evaluateConditions();
      appendNavButtons();
    }

    function showStep(index) {
      const step = document.querySelector(".step" + index);
      if (!step) return;
      step.style.display = "block";
    }

    function hideStepsAfter(index) {
      const total = getTotalSteps();
      for (let i = index + 1; i < total; i++) {
        const step = document.querySelector(".step" + i);
        if (step) step.style.display = "none";
      }
    }

    function scrollToStep(index) {
      const step = document.querySelector(".step" + index);
      if (!step) return;
      step.setAttribute("tabindex", "-1");
      step.focus({ preventScroll: false });
      step.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function appendNavButtons() {
      document.querySelectorAll(".nav-buttons").forEach(function (container) {
        container.innerHTML = "";
      });

      const step = document.querySelector(".step" + currentStep);
      const buttonContainer = step ? step.querySelector(".nav-buttons") : null;
      if (!buttonContainer) return;

      function hasVisibleEnd(stepEl) {
        if (!stepEl) return false;

        stepEl.querySelectorAll('[data-hidden-by-end="true"]').forEach(function (el) {
          el.style.display = "";
          el.removeAttribute("data-hidden-by-end");
        });

        const ends = Array.from(stepEl.querySelectorAll(".end"));
        if (!ends.length) return false;

        function isEffectivelyVisible(el) {
          if (!el) return false;
          let node = el;
          while (node && node.nodeType === 1) {
            const style = getComputedStyle(node);
            if (style.display === "none" || style.visibility === "hidden") {
              return false;
            }
            node = node.parentElement;
          }
          return true;
        }

        const visibleEnds = ends.filter(isEffectivelyVisible);
        if (!visibleEnds.length) return false;

        let earliest = visibleEnds[0];
        visibleEnds.forEach(function (end) {
          if (end === earliest) return;
          const pos = earliest.compareDocumentPosition(end);
          if (pos & Node.DOCUMENT_POSITION_PRECEDING) {
            earliest = end;
          }
        });

        const walker = document.createTreeWalker(
          stepEl,
          NodeFilter.SHOW_ELEMENT,
          null,
          false
        );

        let node;
        let pastEnd = false;
        while ((node = walker.nextNode())) {
          if (node === earliest) {
            pastEnd = true;
            continue;
          }
          if (!pastEnd) continue;
          if (node.closest(".nav-buttons")) continue;

          node.dataset.hiddenByEnd = "true";
          node.style.display = "none";
        }

        return true;
      }

      const isEndStep = hasVisibleEnd(step);

      if (isEndStep) {
        const endMessage = document.createElement("div");
        endMessage.textContent = "End of procedure";
        endMessage.style.fontWeight = "bold";
        endMessage.style.marginBottom = "10px";
        buttonContainer.appendChild(endMessage);
      }

      if (visitedSteps.length > 1) {
        const backButton = document.createElement("button");
        backButton.textContent = "Back";
        backButton.addEventListener("click", function () {
          visitedSteps.pop();
          currentStep = visitedSteps[visitedSteps.length - 1];
          hideStepsAfter(currentStep);
          scrollToStep(currentStep);
          appendNavButtons();
        });
        buttonContainer.appendChild(backButton);
      }

      if (!isEndStep && currentStep < getTotalSteps() - 1) {
        const nextButton = document.createElement("button");
        nextButton.textContent = "Next";
        nextButton.addEventListener("click", function () {
          currentStep++;
          visitedSteps.push(currentStep);
          showStep(currentStep);
          scrollToStep(currentStep);

          executeAllCodeBlocks();
          updateInlineVariables();
          evaluateConditions();
          appendNavButtons();
        });
        buttonContainer.appendChild(nextButton);
      }
    }

    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(initializePage, 0);
    } else {
      window.addEventListener("load", function () {
        setTimeout(initializePage, 0);
      });
    }
  }

  function evaluateExpression(expr, variables) {
    if (!expr) return false;
    const trimmed = expr.trim();
    if (!trimmed) return false;

    try {
      const argNames = Object.keys(variables);
      const fnBody =
        "try {\\n" +
        "  return (" + trimmed + ");\\n" +
        "} catch (error) {\\n" +
        "  if (error instanceof ReferenceError) return false;\\n" +
        "  throw error;\\n" +
        "}";

      const evaluate = new Function(...argNames, fnBody);
      return !!evaluate(...Object.values(variables));
    } catch (e) {
      console.warn("[evaluateExpression] FAILED:", expr, e);
      return false;
    }
  }

  function executeShowIf(variables) {
    console.log("[executeShowIf] Evaluating conditions...");

    const allIfBlocks = document.querySelectorAll(".if");

    allIfBlocks.forEach(function (ifDiv) {
      const stepParent = ifDiv.closest('[class^="step"]');
      if (!stepParent) {
        console.warn("[executeShowIf] ifDiv has no step parent:", ifDiv);
        return;
      }

      const visible = getComputedStyle(stepParent).display !== "none";
      if (!visible) return;

      const exprAttr = ifDiv.getAttribute("data-expression");
      const expr = exprAttr ? exprAttr.trim() : "";
      console.log('[executeShowIf] Expression: "' + expr + '"');
      if (!expr) return;

      const result = evaluateExpression(expr, variables);
      ifDiv.style.display = result ? "block" : "none";
    });
  }

  function updateInlineVariables(variables) {
    function checkForCodeInLine(line) {
      const regex = /\\{\\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*\\}/g;
      return line.replace(regex, function (_, varName) {
        if (Object.prototype.hasOwnProperty.call(variables, varName) && variables[varName] != null) {
          return variables[varName];
        }
        return "{" + varName + "}";
      });
    }

    const divs = document.querySelectorAll("div:not(.if):not(.code)");

    divs.forEach(function (div) {
      const walker = document.createTreeWalker(
        div,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      let node;
      while ((node = walker.nextNode())) {
        if (!node.parentElement.hasAttribute("data-original")) {
          node.parentElement.setAttribute("data-original", node.textContent);
        }

        const original = node.parentElement.getAttribute("data-original");
        node.textContent = checkForCodeInLine(original);
      }
    });
  }

  function executeCodeBlocks(variables) {
    console.log("[executeCodeBlocks] Running code blocks with variables:", variables);

    const visibleSteps = Array.from(document.querySelectorAll('[class^="step"]'))
      .filter(function (div) { return div.style.display !== "none"; });

    if (!visibleSteps.length) return;

    const currentStepDiv = visibleSteps[visibleSteps.length - 1];
    const codeBlocks = currentStepDiv.querySelectorAll("div.code");

    codeBlocks.forEach(function (div) {
      const userCode = div.textContent.trim();
      if (!userCode) return;

      try {
        const fnBody =
          "// Run user code with 'vars' as the scope object\\n" +
          "with (vars) {\\n" +
          userCode +
          "\\n}";

        const wrapped = new Function("vars", fnBody);
        wrapped(variables);
      } catch (e) {
        console.warn("Error evaluating code block:", userCode, e);
      }

      div.style.display = "none";
    });

    console.log("[executeCodeBlocks] Variables after execution:", variables);
  }

  // === RepeatStep runtime ===
  var repeatStepNavInitialized = false;
  var currentRepeatStepVariables = null;

  function clearStepIteration(stepDiv, variables) {
    if (!stepDiv) return;

    stepDiv.querySelectorAll("input").forEach(function (input) {
      if (input.type === "checkbox" || input.type === "radio") {
        input.checked = false;
      } else {
        input.value = "";
      }
    });

    stepDiv.querySelectorAll(".question-block").forEach(function (block) {
      block.querySelectorAll("button").forEach(function (button) {
        button.style.backgroundColor = "";
        button.style.outline = "";
      });
    });
  }

  function setupRepeatStepNavigation(variables) {
    currentRepeatStepVariables = variables;

    if (repeatStepNavInitialized) return;
    repeatStepNavInitialized = true;

    document.addEventListener(
      "click",
      function (event) {
        var btn = event.target.closest(".nav-buttons button");
        if (!btn) return;

        if (btn.textContent.trim().toLowerCase() !== "next") return;

        var stepDiv = btn.closest('[class^="step"]');
        if (!stepDiv) return;

        var expr = stepDiv.getAttribute("data-repeat-step-until");
        if (!expr) return;

        var vars = currentRepeatStepVariables;
        if (!vars) return;

        var ok = evaluateExpression(expr, vars);

        if (!ok) {
          event.preventDefault();
          event.stopPropagation();
          if (event.stopImmediatePropagation) {
            event.stopImmediatePropagation();
          }

          clearStepIteration(stepDiv, vars);
          executeCodeBlocks(vars);
          updateInlineVariables(vars);
          executeShowIf(vars);
        }
      },
      true
    );
  }

  // Boot
  initializeInputHandling(variables);
  initializeQuestionButtons(variables);
  initializeNavigation({
    executeAllCodeBlocks: function () { executeCodeBlocks(variables); },
    updateInlineVariables: function () { updateInlineVariables(variables); },
    evaluateConditions: function () { executeShowIf(variables); }
  });
  setupRepeatStepNavigation(variables);
</script>
`;

   const fullHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated Page</title>
  <style>
    div.code {
      display: none !important;
    }
   .block-styling {
    padding: 15px;
    border: 1px solid transparent;
    margin-bottom: 20px;
    border-radius: 4px;
  }

  .warning-styling {
    color: #856404;
    background-color: #fff3cd;
    border-color: #ffeeba;
  }

  .error-styling {
    color: #721c24;
    background-color: #f8d7da;
    border-color: #f5c6cb;
  }

  .info-styling {
    color: #0c5460;
    background-color: #d1ecf1;
    border-color: #bee5eb;
  }

  .success-styling {
    color: #3c763d;
    background-color: #dff0d8;
    border-color: #d6e9c6;
  }
  </style>
  <link rel="stylesheet" href="https://cdn.simplecss.org/simple.css">
</head>
<body>
  <div id="website_content">
    ${renderedHTML}
  </div>
  ${runtimeScript}
</body>
</html>`;

   const blob = new Blob([fullHTML], { type: "text/html" });
   const link = document.createElement("a");
   link.href = URL.createObjectURL(blob);
   link.download = "interactive_page.html";
   document.body.appendChild(link);
   link.click();
   document.body.removeChild(link);
}
