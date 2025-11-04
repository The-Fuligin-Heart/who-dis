/*
 * main.js - The core script for 'my-phone-ringer' module
 */

// This function is the "guts" - it shows the phone.
// It's the same code we've been using, but now it's a module function.
function showPhone(data) {
  const { imagePath, soundPath } = data;
  const RINGER_ID = "my-phone-ringer-container";
  const STYLE_ID = "my-phone-ringer-style";
  
  // ... [All the CSS and HTML injection code from our macro] ...
  // ... [All the sound playing and animation logic] ...
}

/*
 * HOOK 1: The 'init' hook
 * This runs very early. We use it to register our settings.
 */
Hooks.once("init", () => {
  console.log("Who Dis? | Initializing settings...");

  // Register the setting for the phone image
  game.settings.register("my-phone-ringer", "imagePath", {
    name: "Phone Image Path",
    hint: "Path to the phone image file.",
    scope: "world",     // GM controls this for all players
    config: true,       // Show this in the module settings
    type: String,       // It's a string (file path)
    default: "modules/my-phone-ringer/assets/default-phone.png",
    filePicker: "image" // Use the built-in image file picker!
  });

  // Register the setting for the ringtone
  game.settings.register("my-phone-ringer", "soundPath", {
    name: "Ringtone Path",
    hint: "Path to the ringtone audio file.",
    scope: "world",
    config: true,
    type: String,
    default: "modules/my-phone-ringer/assets/default-ringtone.mp3",
    filePicker: "audio" // Use the built-in audio file picker!
  });
});

/*
 * HOOK 2: The 'ready' hook
 * This runs when the client is fully loaded.
 * We use it to register our socket listener for all players.
 */
Hooks.once("ready", () => {
  // 1. Register our 'showPhone' function with socketlib
  if (game.modules.get("socketlib")?.active) {
    window.MyPhoneRingerSocket = socketlib.registerModule("my-phone-ringer");
    window.MyPhoneRingerSocket.register("showPhone", showPhone);
  } else {
    if (game.user.isGM) {
      ui.notifications.error("Phone Ringer module requires Socketlib to be active!");
    }
  }
  
  // 2. (Optional) Log to console for all users
  console.log("PhoneRinger | Listener registered. Ready for calls.");
});

/*
 * HOOK 3: The 'getSceneControlButtons' hook
 * This runs when the sidebar tools are drawn.
 * We use it to add a new button for the GM.
 */
Hooks.on("getSceneControlButtons", (controls) => {
  if (game.user.isGM) {
    // Find the 'Token' controls group
    const tokenControls = controls.find(c => c.name === "token");
    
    // Add our new button to it
    if (tokenControls) {
      tokenControls.tools.push({
        name: "ring-phone",
        title: "Ring Players' Phones",
        icon: "fas fa-phone-volume",
        onClick: () => {
          // When GM clicks the button...
          // 1. Get the custom paths from the settings
          const img = game.settings.get("my-phone-ringer", "imagePath");
          const snd = game.settings.get("my-phone-ringer", "soundPath");

          // 2. Execute the function for everyone!
          window.MyPhoneRingerSocket.executeForEveryone("showPhone", {
            imagePath: img,
            soundPath: snd
          });
        },
        button: true // This makes it a clickable button
      });
    }
  }
});