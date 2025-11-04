/*
 * main.js - The core script for 'who-dis' module
 *
 * v1.0.6 - Major Refactor:
 * - Implemented CallManagerApp (extends Application) for a full UI.
 * - GMs can now Create, Edit, Delete, and Ring saved calls.
 * - Calls are stored in game.settings.
 * - Re-implemented the UI button (on Journal controls) to open the new App.
 */

// --- [PART 1: THE PHONE RINGER FUNCTION] ---
// This is the same function as before, it just shows the phone.
function showPhone(data) {
  const { imagePath, soundPath, callerID } = data;
  const RINGER_ID = "cell-phone-ringer-container";
  const STYLE_ID = "cell-phone-ringer-style";
  if (document.getElementById(RINGER_ID)) return;

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
      #${RINGER_ID} .caller-id-screen {
        position: absolute; top: 135px; left: 50%; transform: translateX(-50%);
        width: 170px; height: 45px; background-color: #9bbc0f; border: 2px solid #333;
        border-radius: 3px; display: flex; align-items: center; justify-content: center;
        font-family: 'Consolas', 'Courier New', monospace; font-size: 18px; font-weight: bold;
        color: #0f380f; text-shadow: 1px 1px 1px #c6f13c; overflow: hidden;
        text-align: center; padding: 5px; box-sizing: border-box;
      }
      #${RINGER_ID} .answer-button {
        position: absolute; bottom: 90px; left: 50%; transform: translateX(-50%); padding: 10px 20px;
        background-color: #00A000; color: white; font-family: 'Arial', sans-serif; font-weight: bold;
        border: 2px solid #333; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        cursor: pointer; pointer-events: all; text-shadow: 1px 1px 2px #000;
      }
      #${RINGER_ID} .answer-button:hover { background-color: #00C000; }
    </style>
  `;
  const html = `
    <div id="${RINGER_ID}">
      <div class="caller-id-screen">${callerID || "INCOMING CALL"}</div>
      <button class="answer-button">ANSWER</button>
    </div>
  `;
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


// --- [PART 2: THE NEW CALL MANAGER APPLICATION] ---
class CallManagerApp extends Application {

  constructor(options = {}) {
    super(options);
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "who-dis-manager",
      title: "Who Dis? - Call Manager",
      template: "modules/who-dis/templates/call-manager.hbs",
      width: 400,
      height: 300,
      resizable: true,
      classes: ["who-dis", "dialog"],
    });
  }

  /**
   * Get the data to render the template
   */
  getData() {
    const savedCalls = game.settings.get("who-dis", "savedCalls");
    // Convert object to array for easier handling in handlebars
    const calls = Object.entries(savedCalls).map(([id, callData]) => {
      return {
        id: id,
        ...callData
      }
    });

    return {
      calls: calls
    };
  }

  /**
   * Add listeners for buttons (Create, Ring, Edit, Delete)
   */
  activateListeners(html) {
    super.activateListeners(html);

    // Create New Call
    html.find('button[data-action="create"]').on('click', this._onCreateCall.bind(this));

    // Button controls on each list item
    html.find('.control-tool').on('click', (event) => {
      const action = event.currentTarget.dataset.action;
      const callId = $(event.currentTarget).closest('.directory-item').data('callId');
      
      switch (action) {
        case 'ring':
          this._onRingCall(callId);
          break;
        case 'edit':
          this._onEditCall(callId);
          break;
        case 'delete':
          this._onDeleteCall(callId);
          break;
      }
    });
  }

  /**
   * Get all saved calls
   */
  _getCalls() {
    return game.settings.get("who-dis", "savedCalls");
  }

  /**
   * Save the updated calls object
   */
  async _saveCalls(calls) {
    await game.settings.set("who-dis", "savedCalls", calls);
    this.render(); // Re-render the app to show changes
  }

  /**
   * Send the ring signal for a specific call
   */
  _onRingCall(callId) {
    const calls = this._getCalls();
    const callData = calls[callId];
    if (!callData) {
      ui.notifications.error("Call not found!");
      return;
    }
    
    // Send the socket event
    ui.notifications.info(`Ringing players with: ${callData.callerID}`);
    window.MyPhoneRingerSocket.executeForEveryone("showPhone", callData);
  }

  /**
   * Open the edit dialog
   */
  _onEditCall(callId) {
    const calls = this._getCalls();
    const callData = calls[callId];
    this._openCallDialog(callData, callId);
  }

  /**
   * Open the create/edit dialog
   */
  _onCreateCall() {
    this._openCallDialog({}, null);
  }

  /**
   * Deletes a call after confirmation
   */
  _onDeleteCall(callId) {
    Dialog.confirm({
      title: "Delete Call",
      content: "<p>Are you sure you want to delete this call?</p>",
      yes: async () => {
        const calls = this._getCalls();
        delete calls[callId]; // Remove the call
        await this._saveCalls(calls);
      },
      no: () => {},
      defaultYes: false
    });
  }

  /**
   * The main dialog window for Creating or Editing a call
   */
  _openCallDialog(callData = {}, callId = null) {
    const defaultImg = game.settings.get("who-dis", "defaultImage");
    const defaultSnd = game.settings.get("who-dis", "defaultSound");

    // Use existing data or defaults
    const data = {
      callerID: callData.callerID || "INCOMING CALL",
      imagePath: callData.imagePath || defaultImg,
      soundPath: callData.soundPath || defaultSnd
    };

    const title = callId ? "Edit Call" : "Create New Call";
    
    const content = `
      <form>
        <div class="form-group">
          <label>Caller ID:</label>
          <input type="text" id="caller-id" value="${data.callerID}">
        </div>
        <div class="form-group">
          <label>Phone Image:</label>
          <div style="display: flex; align-items: center;">
            <input type="text" id="phone-image" value="${data.imagePath}">
            <button type="button" class="file-picker" data-type="imagevideo" data-target="phone-image">
              <i class="fas fa-search"></i>
            </button>
          </div>
        </div>
        <div class="form-group">
          <label>Ringtone:</label>
          <div style="display: flex; align-items: center;">
            <input type="text" id="phone-sound" value="${data.soundPath}">
            <button type="button" class="file-picker" data-type="audio" data-target="phone-sound">
              <i class="fas fa-search"></i>
            </button>
          </div>
        </div>
      </form>
    `;
    
    new Dialog({
      title: title,
      content: content,
      render: (html) => {
        html.find('button.file-picker').on('click', (event) => {
          const button = $(event.currentTarget);
          const targetInput = html.find(`input#${button.data('target')}`);
          const type = button.data('type');
          new FilePicker({
            type: type,
            current: targetInput.val(),
            callback: (path) => { targetInput.val(path); }
          }).browse(targetInput.val());
        });
      },
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Save",
          callback: async (html) => {
            const newCallData = {
              callerID: html.find('#caller-id').val(),
              imagePath: html.find('#phone-image').val(),
              soundPath: html.find('#phone-sound').val()
            };

            const calls = this._getCalls();
            const idToSave = callId || foundry.utils.randomID(); // Use existing ID or create new one
            calls[idToSave] = newCallData;
            await this._saveCalls(calls);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "save"
    }).render(true);
  }
}


// --- [PART 3: THE HOOKS] ---

/*
 * HOOK 1: The 'init' hook
 * Register settings for defaults and for call storage
 */
Hooks.once("init", () => {
  console.log("Who Dis? | Initializing settings...");

  game.settings.register("who-dis", "defaultImage", {
    name: "Default Phone Image",
    hint: "Default path for the phone image.",
    scope: "world",
    config: true,
    type: String,
    default: "modules/who-dis/assets/default-phone.png",
    filePicker: "image"
  });

  game.settings.register("who-dis", "defaultSound", {
    name: "Default Ringtone",
    hint: "Default path for the ringtone.",
    scope: "world",
    config: true,
    type: String,
    default: "modules/who-dis/assets/default-ringtone.mp3",
    filePicker: "audio"
  });

  game.settings.register("who-dis", "savedCalls", {
    name: "Saved Phone Calls",
    scope: "world",
    config: false, // Not user-configurable from settings menu
    type: Object,
    default: {} // Store calls as an object with random IDs
  });
});

/*
 * HOOK 2: The 'ready' hook
 * Register socket listener
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

  // Make our App available globally
  window.WhoDisManager = CallManagerApp;
});

/*
 * HOOK 3: The 'getSceneControlButtons' hook
 * Add a button to the Journal (notes) controls
 */
Hooks.on("getSceneControlButtons", (controls) => {
  if (game.user.isGM) {
    const notesControls = controls.notes;
    if (notesControls) {
      notesControls.tools.push({
        name: "who-dis-manager",
        title: "Who Dis? Call Manager",
        icon: "fas fa-mobile-alt",
        onClick: () => {
          new CallManagerApp().render(true);
        },
        button: true
      });
    }
  }
});