/*
 * main.js - The core script for 'who-dis' module
 *
 * v1.0.1 - Fixed 'controls.find' bug. 'controls' is an object, not an array.
 */

// This function is the "guts" - it shows the phone.
function showPhone(data) {
  const { imagePath, soundPath } = data;

  const RINGER_ID = "cell-phone-ringer-container";
  const STYLE_ID = "cell-phone-ringer-style";

  if (document.getElementById(RINGER_ID)) return; // Already ringing

  const css = `
    <style id="${STYLE_ID}">
      @keyframes shake {
        0%, 100% { transform: translateX(-50%) rotate(0deg); } 10% { transform: translateX(-51%) rotate(-2deg); }
        20% { transform: translateX(-49%) rotate(2deg); } 30% { transform: translateX(-51%) rotate(-2deg); }
        40% { transform: translateX(-49%) rotate(2deg); } 50% { transform: translateX(-51%) rotate(-2deg); }
        60% { transform: translateX(-49%) rotate(2deg); } 70% { transform: translateX(-51%) rotate(-2deg); }
        80% { transform: translateX(-49%) rotate(2deg); } 90% { transform: translateX(-51%) rotate(-2deg); }
      }
      #${RINGER_ID} {
        position: fixed; bottom: -500px; left: 50%; transform: translateX(-50%); width: 300px; height: 480px;
        background-image: url('${imagePath}'); background-size: contain; background-repeat: no-repeat;
        background-position: center bottom; transition: bottom 0.7s cubic-bezier(0.17, 0.67, 0.3, 1.03);
        z-index: 9999; pointer-events: none;
      }
      #${RINGER_ID}.visible { bottom: -50px; animation: shake 0.4s linear infinite; }
      #${RINGER_ID} .answer-button {
        position: absolute; bottom: 90px; left: 50%; transform: translateX(-50%); padding: 10px 20px;
        background-color: #00A000; color: white; font-family: 'Arial', sans-serif; font-weight: bold;
        border: 2px solid #333; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        cursor: pointer; pointer-events: all; text-shadow: 1px 1px 2px #000;
      }
      #${RINGER_ID} .answer-button:hover { background-color: #00C000; }
    </style>
  `;

  const html = `<div id="${RINGER_ID}"><button class="answer-button">ANSWER</button></div>`;

  $('head').append(css);
  $('body').append(html);

  const ringerElement = document.getElementById(RINGER_ID);
  const answerButton = ringerElement.querySelector('.answer-button');

  AudioHelper.play({ src: soundPath, volume: 0.7, loop: true }, true).then(sound => {
    const stopRinging = () => {
      if (sound) sound.stop();
      ringerElement.classList.remove('visible');
      setTimeout(() => {
        ringerElement.remove();
        document.getElementById(STYLE_ID)?.remove();
      }, 1000);
    };
    answerButton.addEventListener('click', stopRinging);
  });

  setTimeout(() => ringerElement.classList.add('visible'), 50);
}

/*
 * HOOK 1: The 'init' hook
 */
Hooks.once("init", () => {
  console.log("Who Dis? | Initializing settings...");

  game.settings.register("who-dis", "imagePath", {
    name: "Phone Image Path",
    hint: "Path to the phone image file.",
    scope: "world",
    config: true,
    type: String,
    default: "modules/who-dis/assets/default-phone.png",
    filePicker: "image"
  });

  game.settings.register("who-dis", "soundPath", {
    name: "Ringtone Path",
    hint: "Path to the ringtone audio file.",
    scope: "world",
    config: true,
    type: String,
    default: "modules/who-dis/assets/default-ringtone.mp3",
    filePicker: "audio"
  });
});

/*
 * HOOK 2: The 'ready' hook
 */
Hooks.once("ready", () => {
  if (game.modules.get("socketlib")?.active) {
    window.MyPhoneRingerSocket = socketlib.registerModule("who-dis");
    window.MyPhoneRingerSocket.register("showPhone", showPhone);
  } else {
    if (game.user.isGM) {
      ui.notifications.error("Who Dis? module requires Socketlib to be active!");
    }
  }
  console.log("Who Dis? | Listener registered. Ready for calls.");
});

/*
 * HOOK 3: The 'getSceneControlButtons' hook
 */
Hooks.on("getSceneControlButtons", (controls) => {
  if (game.user.isGM) {
    // Find the 'Token' controls group
    const tokenControls = controls.token; // <-- THIS IS THE FIX

    // Add our new button to it
    if (tokenControls) {
      tokenControls.tools.push({
        name: "ring-phone",
        title: "Ring Players' Phones",
        icon: "fas fa-phone-volume",
        onClick: () => {
          // When GM clicks the button...
          const img = game.settings.get("who-dis", "imagePath");
          const snd = game.settings.get("who-dis", "soundPath");

          // Execute the function for everyone!
          window.MyPhoneRingerSocket.executeForEveryone("showPhone", {
            imagePath: img,
            soundPath: snd
          });
        },
        button: true
      });
    }
  }
});