/*
 * main.js - The core script for 'who-dis' module
 *
 * v1.0.9 - Major Feature Update
 * - Added Global "Answer": Clicking 'Answer' now stops the call for all players
 * by sending a socket request to the GM, who then broadcasts a stop command.
 * - Added Bundled Asset Dropdowns: Replaced FilePickers with <select> dropdowns
 * for a curated list of images and sounds defined in ASSET_REGISTRY.
 */

// --- [PART 1: THE PHONE RINGER FUNCTION] ---
// This is the same function as before, it just shows the phone.
function showPhone(data) {
  const { imagePath, soundPath, callerID } = data;
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
    // Attach the sound object to the element so 'stopCall' can find it
    ringerElement.sound = sound;

    // --- [NEW] Answer Button Logic ---
    answerButton.addEventListener('click', () => {
      // 1. Immediately stop it locally
      stopCall(); 
      // 2. Tell the GM (and by proxy, everyone else) to stop
      window.MyPhoneRingerSocket.executeAsGM("requestStopCall");
    });
  });

  setTimeout(() => ringerElement.classList.add('visible'), 50);
}

// --- [PART 3: GM-ONLY SOCKET FUNCTION] ---

/**
 * This function ONLY runs on the GM's client.
 * A player calls this, and the GM then broadcasts to everyone.
 */
function requestStopCall() {
  if (!game.user.isGM) return;
  
  // GM broadcasts the 'stopCall' command to all players
  window.MyPhoneRingerSocket.executeForEveryone("stopCall");
}


// --- [PART 4: THE CALL MANAGER APPLICATION] ---
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
      height: 350,
      resizable: true,
      classes: ["who-dis", "dialog"],
    });
  }

  getData() {
    const savedCalls = game.settings.get("who-dis", "savedCalls");
    const calls = Object.entries(savedCalls).map(([id, callData]) => {
      return {
        id: id,
        ...callData
      }
    });
    return { calls: calls };
  }
  
  activateListeners(html) {
    super.activateListeners(html);
    html.find('button[data-action="create"]').on('click', this._onCreateCall.bind(this));
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

  _getCalls() {
    return game.settings.get("who-dis", "savedCalls");
  }

  async _saveCalls(calls) {
    await game.settings.set("who-dis", "savedCalls", calls);
    this.render();
  }

  _onRingCall(callId) {
    const calls = this._getCalls();
    const callData = calls[callId];
    if (!callData) {
      ui.notifications.error("Call not found!");
      return;
    }
    
    const ringAll = (!callData.targetPlayers || callData.targetPlayers.includes('all'));

    if (ringAll) {
      ui.notifications.info(`Ringing all players with: ${callData.callerID}`);
      window.MyPhoneRingerSocket.executeForEveryone("showPhone", callData);
    } else {
      const targetNames = callData.targetPlayers.map(userId => {
        return game.users.get(userId)?.name || 'Unknown';
      });
      ui.notifications.info(`Ringing ${targetNames.join(', ')} with: ${callData.callerID}`);
      window.MyPhoneRingerSocket.executeForUsers(callData.targetPlayers, "showPhone", callData);
    }
  }

  _onEditCall(callId) {
    const calls = this._getCalls();
    const callData = calls[callId];
    this._openCallDialog(callData, callId);
  }

  _onCreateCall() {
    this._openCallDialog({}, null);
  }

  _onDeleteCall(callId) {
    Dialog.confirm({
      title: "Delete Call",
      content: "<p>Are you sure you want to delete this call?</p>",
      yes: async () => {
        const calls = this._getCalls();
        delete calls[callId];
        await this._saveCalls(calls);
      },
      no: () => {},
      defaultYes: false
    });
  }

  /**
   * [HEAVILY MODIFIED] The main dialog for Creating or Editing a call
   * Now uses <select> dropdowns based on ASSET_REGISTRY
   */
  _openCallDialog(callData = {}, callId = null) {
    // --- Prepare data for the template ---
    
    // Check if we are targeting all or specific
    const isSpecific = Array.isArray(callData.targetPlayers) && !callData.targetPlayers.includes('all');
    
    // Get all users and mark if they are checked
    const allUsers = game.users.map(u => ({
      id: u.id,
      name: u.name,
      checked: isSpecific ? callData.targetPlayers.includes(u.id) : false
    }));

    // Use existing data or pull from defaults
    const data = {
      callerID: callData.callerID || "INCOMING CALL",
      imagePath: callData.imagePath || ASSET_REGISTRY.images[Object.keys(ASSET_REGISTRY.images)[0]],
      soundPath: callData.soundPath || ASSET_REGISTRY.sounds[Object.keys(ASSET_REGISTRY.sounds)[0]]
    };

    const title = callId ? "Edit Call" : "Create New Call";
    
    // --- Build the new HTML with <select> dropdowns ---
    
    // Build image dropdown
    let imageOptions = Object.entries(ASSET_REGISTRY.images).map(([name, path]) => {
      const selected = (path === data.imagePath) ? 'selected' : '';
      return `<option value="${path}" ${selected}>${name}</option>`;
    }).join('');

    // Build sound dropdown
    let soundOptions = Object.entries(ASSET_REGISTRY.sounds).map(([name, path]) => {
      const selected = (path === data.soundPath) ? 'selected' : '';
      return `<option value="${path}" ${selected}>${name}</option>`;
    }).join('');

    let userChecklistHTML = '';
    allUsers.forEach(u => {
      userChecklistHTML += `
        <label class="checkbox">
          <input type="checkbox" name="targetUsers" value="${u.id}" ${u.checked ? 'checked' : ''}>
          ${u.name}
        </label>
      `;
    });

    const content = `
      <form style="display: flex; flex-direction: column; height: 100%;">
        <div class="form-group">
          <label>Caller ID:</label>
          <input type="text" id="caller-id" value="${data.callerID}">
        </div>
        <div class="form-group">
          <label>Phone Image:</label>
          <select id="phone-image">
            ${imageOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Ringtone:</label>
          <select id="phone-sound">
            ${soundOptions}
          </select>
        </div>
        
        <hr>
        
        <div class="form-group">
          <label>Target Players:</label>
          <div>
            <label class="radio">
              <input type="radio" name="targetType" value="all" ${!isSpecific ? 'checked' : ''}>
              Ring All Players
            </label>
            <label class="radio">
              <input type="radio" name="targetType" value="specific" ${isSpecific ? 'checked' : ''}>
              Ring Specific Players
            </label>
          </div>
        </div>
        
        <div id="user-checklist" style="flex: 1; overflow-y: auto; border: 1px solid #ccc; padding: 5px; margin-bottom: 10px; ${!isSpecific ? 'display: none;' : ''}">
          ${userChecklistHTML}
        </div>
      </form>
    `;
    
    new Dialog({
      title: title,
      content: content,
      render: (html) => {
        // Radio button listener to show/hide the checklist
        html.find('input[name="targetType"]').on('change', (event) => {
          const showChecklist = $(event.currentTarget).val() === 'specific';
          if (showChecklist) {
            html.find('#user-checklist').slideDown(200);
          } else {
            html.find('#user-checklist').slideUp(200);
          }
        });
      },
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Save",
          callback: async (html) => {
            const targetType = html.find('input[name="targetType"]:checked').val();
            let targetPlayers = [];
            
            if (targetType === 'all') {
              targetPlayers = ['all'];
            } else {
              targetPlayers = html.find('input[name="targetUsers"]:checked').map((i, el) => $(el).val()).get();
            }

            const newCallData = {
              callerID: html.find('#caller-id').val(),
              imagePath: html.find('#phone-image').val(), // Get value from <select>
              soundPath: html.find('#phone-sound').val(), // Get value from <select>
              targetPlayers: targetPlayers
            };

            const calls = this._getCalls();
            const idToSave = callId || foundry.utils.randomID();
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
    }, 
    { height: 'auto', width: 450 }).render(true); 
  }
}


// --- [PART 5: THE HOOKS] ---

/*
 * HOOK 1: The 'init' hook
 */
Hooks.once("init", () => {
  console.log("Who Dis? | Initializing settings...");

  // We change the defaults to just pull from the asset registry
  const defaultImg = ASSET_REGISTRY.images[Object.keys(ASSET_REGISTRY.images)[0]];
  const defaultSnd = ASSET_REGISTRY.sounds[Object.keys(ASSET_REGISTRY.sounds)[0]];

  game.settings.register("who-dis", "defaultImage", {
    name: "Default Phone Image",
    hint: "Default path for the phone image.",
    scope: "world",
    config: true,
    type: String,
    default: defaultImg,
    filePicker: "image"
  });

  game.settings.register("who-dis", "defaultSound", {
    name: "Default Ringtone",
    hint: "Default path for the ringtone.",
    scope: "world",
    config: true,
    type: String,
    default: defaultSnd,
    filePicker: "audio"
  });

  game.settings.register("who-dis", "savedCalls", {
    name: "Saved Phone Calls",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });
});

/*
 * HOOK 2: The 'ready' hook
 * [MODIFIED] We now register THREE socket functions
 */
Hooks.once("ready", () => {
  if (game.modules.get("socketlib")?.active) {
    window.MyPhoneRingerSocket = socketlib.registerModule("who-dis");
    
    // 1. GM calls this to show the phone
    window.MyPhoneRingerSocket.register("showPhone", showPhone);
    
    // 2. Player calls this (as GM) to request a stop
    window.MyPhoneRingerSocket.register("requestStopCall", requestStopCall);
    
    // 3. GM calls this to make everyone's phone stop
    window.MyPhoneRingerSocket.register("stopCall", stopCall);

  } else {
    if (game.user.isGM) {
      ui.notifications.error("Who Dis? module requires Socketlib to be active!");
    }
  }
  console.log("Who Dis? | Listener registered. Ready for calls.");
  
  // Make our App available globally for the macro
  window.WhoDisManager = CallManagerApp;
});