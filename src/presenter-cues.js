// Shared by the projected cue and the notes sent to the mobile companion.
export const PRESENTER_CUES = {
  "three-agents": {
    label: "Live example", duration: "1 min",
    show: "Open the rehearsed Tool Calling recipe demo. Give it one task and show the result.",
    say: "You’ll get a voice agent running first. Then we’ll look at the recipe behind this behavior and adapt a recipe to your own idea.",
    check: "Ask attendees to think of one task they would want a voice agent to handle.",
    returnTo: "Return to ‘Agora’s role in your voice app’ after the conversation."
  },
  "open-agora": {
    label: "Console", duration: "3 min",
    show: "Switch to Agora Console. Show the project dashboard and where an attendee selects their own project.",
    say: "Keep your Console tab open. The CLI will use your Agora account to set up the quickstart.",
    check: "Everyone can open their own Console. Helpers handle account verification issues.",
    returnTo: "Return to the code workshop overview."
  },
  "install-cli": {
    label: "Docs + terminal", duration: "2 min",
    show: "Open the linked CLI installation guide. Choose the operating system, copy the install command, and run it in the terminal. Run agora version and agora doctor.",
    say: "The command is on your slide too. The installation guide has the current instructions for your operating system.",
    check: "The terminal reports an installed CLI version. Helpers take any setup errors.",
    returnTo: "Return to ‘Sign in with the CLI’."
  },
  "authenticate-cli": {
    label: "Terminal + browser", duration: "2 min",
    show: "Run agora login, complete the browser authorization, and return to the terminal.",
    say: "This connects the CLI to your Agora account. You’ll select your project when creating the quickstart.",
    check: "Attendees see the CLI’s authorization confirmation.",
    returnTo: "Return to ‘Create the workshop folder’."
  },
  "open-terminal": {
    label: "Terminal", duration: "1 min",
    show: "Open a terminal, create agora_agents_workshop, and change into it. Show the terminal’s current directory before continuing.",
    say: "We’ll keep the quickstart and recipe projects in this folder. Check that your terminal is here before running the next command.",
    check: "Attendees’ terminals are in agora_agents_workshop.",
    returnTo: "Return to ‘Initialize the quickstart’."
  },
  "initialize-quickstart": {
    label: "Terminal", duration: "4 min",
    show: "From agora_agents_workshop, run the selected track’s init command. Show project selection and the printed setup instructions.",
    say: "We’ll run this starter unchanged so we have a working example to refer back to.",
    check: "The command completes and agent-quickstart exists.",
    returnTo: "Return to ‘Run the quickstart’."
  },
  "run-quickstart": {
    label: "Terminal + app", duration: "7 min",
    show: "Run the setup commands, open the local app, allow microphone access, and have a short conversation. End the session.",
    say: "You have a working voice agent. Next we’ll look at the code behind the conversation.",
    check: "Ask for a show of hands from attendees who hear a reply.",
    returnTo: "Return to ‘Inside the agent file’."
  },
  "open-agent-file": {
    label: "Code editor", duration: "4 min",
    show: "Open the generated agent file. Point to the SDK import, instructions, model configuration, and session start and stop.",
    say: "These instructions shape what the agent says. This configuration chooses the models. These calls control the session.",
    check: "Attendees can locate the agent file and identify where its behavior is defined.",
    returnTo: "Return to ‘Four parts of the agent code’ to recap."
  },
  "return-workshop-root": {
    label: "Terminal", duration: "1 min",
    show: "Stop the quickstart with Ctrl+C if it is still running. Change back to agora_agents_workshop and show the current directory and agent-quickstart folder.",
    say: "The quickstart stays in its own folder. We’ll create the recipe project beside it, so we can return to the working example.",
    check: "The terminal is in agora_agents_workshop, outside agent-quickstart.",
    returnTo: "Return to ‘Agora Recipes’."
  },
  "agora-recipes": {
    label: "Recipe catalog", duration: "3 min",
    show: "Reopen the Tool Calling recipe from the opening demo. Show its repository and README, then briefly browse another use case.",
    say: "The quickstart gave us the basic conversation. This recipe adds tool calls. Your idea may need a different recipe.",
    check: "Attendees can describe a behavior they want. They do not need to choose a recipe yet.",
    returnTo: "Return to ‘Find and inspect a recipe’."
  },
  "discover-recipes": {
    label: "Terminal", duration: "2 min",
    show: "Run agora recipes list --type ai, then agora recipes show tool-calling. Point to the prerequisites and setup details.",
    say: "The coding assistant can use these same commands to find a recipe for your use case.",
    check: "Attendees recognize the recipe slug and can find its runtime requirements.",
    returnTo: "Return to ‘Create a project from the recipe’."
  },
  "initialize-recipe": {
    label: "Terminal", duration: "3 min",
    show: "Run agora init recipe-demo --recipe tool-calling from the workshop folder. Show the generated README and next steps. Return to the workshop folder if you entered recipe-demo.",
    say: "This is how the CLI sets up a recipe. Your coding assistant will use Skills and the CLI to adapt a suitable example for your idea.",
    check: "Show that the recipe is separate from agent-quickstart. Running this third app is optional.",
    returnTo: "Return to ‘Docs your coding assistant can use’."
  },
  "docs-for-agents": {
    label: "Docs", duration: "2 min",
    show: "Open the Skills guide, use Copy Page, and paste into an unsent draft to show the content. Clear the draft. Open llms.txt and follow the AI index.",
    say: "Your coding assistant can read the same instructions. The index helps it find relevant pages, and Skills guide how it uses them.",
    check: "Attendees know how to provide a relevant page when their assistant needs API details.",
    returnTo: "Return to ‘Install Agora Skills’."
  },
  "install-agora-skills": {
    label: "Terminal + editor", duration: "3 min",
    show: "Install Skills in the workspace where you’ll build. Choose project scope if asked, refresh your coding assistant, and show that it loaded Agora Skills.",
    say: "Use the workshop folder for a new app. If you’re updating an app, install Skills and open your coding assistant in that app’s workspace.",
    check: "Attendees have Agora Skills available in the correct workspace.",
    returnTo: "Return to ‘Describe your use case’."
  },
  "build-prompt": {
    label: "Coding assistant", duration: "3 min",
    show: "Choose New or Update, copy the short prompt, and replace the use case with your example. Show the assistant using Skills and the CLI to select a recipe.",
    say: "Describe who the agent helps and what it should do. Choose one conversation that will show whether it works.",
    check: "Each participant has a use case and can explain how they will test it.",
    returnTo: "Return to ‘A recipe adapted to your use case’ while the room builds."
  },
  "run-website-sdr": {
    label: "Terminal + app", duration: "5 min",
    show: "Use your generated project’s README to install and run it. Open the local app and start a conversation.",
    say: "Use your project’s instructions. Your recipe may use a different runtime from our quickstart.",
    check: "The app loads locally and the voice agent responds. Helpers work with blocked attendees.",
    returnTo: "Return to ‘Does the agent do what you asked?’"
  },
  "speak-with-sdr": {
    label: "Your app", duration: "5 min",
    show: "Try the conversation you chose before building. Inspect any tool result or saved output, then end the session.",
    say: "Check what the app actually did. If it simulates an action, the user should know.",
    check: "Attendees complete one conversation for their use case. Invite two people to share a result.",
    returnTo: "Return to optional sharing, then leave the clinic slide visible for support."
  }
};

export function createCueSection(cue, document) {
  const section = document.createElement("section");
  section.className = "demo-script";
  const heading = document.createElement("h3");
  heading.textContent = `Desktop demo: ${cue.label} (${cue.duration})`;
  section.append(heading);
  const list = document.createElement("dl");
  for (const [key, label] of [["show", "Show"], ["say", "Say"], ["check", "Checkpoint"], ["returnTo", "Return"]]) {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = cue[key];
    list.append(term, description);
  }
  section.append(list);
  return section;
}
