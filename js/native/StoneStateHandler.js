import { LocationHandler } from '../native/LocationHandler';
import { Scheduler } from '../logic/Scheduler';
import { LOG, LOGDebug } from '../logging/Log'
import { getUUID } from '../util/util'
import { DISABLE_TIMEOUT } from '../ExternalConfig'


let TRIGGER_ID = "RSSI_TRIGGER_FUNCTION";
let RSSI_TIMEOUT = 6000;
let RSSI_REFRESH = 1;
/**
 * This class keeps track of the disability state of the crownstone.
 *
 * If a Crownstone is disabled, it means it has not been heard for the last 30 seconds, ibeacon, adv or via mesh.
 */
class StoneStateHandlerClass {
  constructor() {
    this.store = {};
    this.timeoutActions = {};
    this._initialized = false;

    // create a trigger to throttle the updates.
    Scheduler.setRepeatingTrigger(TRIGGER_ID,{repeatEveryNSeconds: RSSI_REFRESH});
  }

  loadStore(store) {
    LOG('LOADED STORE StoneStateHandlerClass', this._initialized);
    if (this._initialized === false) {
      this.store = store;
    }
  }

  receivedIBeaconUpdate(sphereId, stoneId, rssi) {
    // only update rssi if there is a measureable difference.
    if (Math.abs(this.store.getState().spheres[sphereId].stones[stoneId].config.rssi - rssi) > 3) {
      // update RSSI, we only use the ibeacon once since it has an average rssi
      Scheduler.loadOverwritableAction(TRIGGER_ID, stoneId, {
        type: 'UPDATE_STONE_RSSI',
        sphereId: sphereId,
        stoneId: stoneId,
        data: {rssi: rssi}
      });
  }

    this.update(sphereId, stoneId);
  }

  receivedUpdate(sphereId, stoneId, rssi) {
    this.update(sphereId, stoneId);
  }

  update(sphereId, stoneId) {
    // LOG("StoneStateHandlerUpdate", sphereId, stoneId);

    const state = this.store.getState();
    // fallback to ensure we never miss an enter or exit event caused by a bug in ios 10

    if (state.spheres[sphereId].config.present === false) {
      LOG("FORCE ENTER SPHERE BY ADVERTISEMENT UPDATE (or ibeacon)");
      LocationHandler.enterSphere(sphereId);
    }

    // if we hear this stone and yet it is set to disabled, we reenable it.
    if (state.spheres[sphereId].stones[stoneId].config.disabled === true) {
      this.store.dispatch({
        type: 'UPDATE_STONE_DISABILITY',
        sphereId: sphereId,
        stoneId: stoneId,
        data: {disabled: false}
      });
    }

    if (this.timeoutActions[sphereId] === undefined) {
      this.timeoutActions[sphereId] = {};
    }
    if (this.timeoutActions[sphereId][stoneId] === undefined) {
      this.timeoutActions[sphereId][stoneId] = {clearTimeout: undefined, clearRSSITimeout: undefined};
    }

    if (this.timeoutActions[sphereId][stoneId].clearTimeout && typeof this.timeoutActions[sphereId][stoneId].clearTimeout === 'function') {
      // LOG("Cancelling_Timeout");
      this.timeoutActions[sphereId][stoneId].clearTimeout();
    }

    if (this.timeoutActions[sphereId][stoneId].clearRSSITimeout && typeof this.timeoutActions[sphereId][stoneId].clearRSSITimeout === 'function') {
      // LOG("Cancelling_RSSI_Timeout");
      this.timeoutActions[sphereId][stoneId].clearRSSITimeout();
    }



    let disableCallback = () => {
      let state = this.store.getState();
      if (state.spheres[sphereId] && state.spheres[sphereId].stones[stoneId]) {
        // check if there are any stones left that are not disabled.
        let otherStoneIds = Object.keys(state.spheres[sphereId].stones);
        let allDisabled = true;
        otherStoneIds.forEach((otherStoneId) => {
          if (otherStoneId !== stoneId) {
            if (state.spheres[sphereId].stones[otherStoneId].config.disabled === false) {
              allDisabled = false;
            }
          }
        });

        // fallback to ensure we never miss an enter or exit event caused by a bug in ios 10
        if (allDisabled === true) {
          LOG("FORCE LEAVING SPHERE DUE TO ALL CROWNSTONES BEING DISABLED");
          LocationHandler.exitSphere(sphereId);
        }

        LOG("Disabling stone ", stoneId);
        this.store.dispatch({
          type: 'UPDATE_STONE_DISABILITY',
          sphereId: sphereId,
          stoneId: stoneId,
          data: {disabled: true, rssi: -1000}
        });
      }
      this.timeoutActions[sphereId][stoneId].clearTimeout = undefined;
      delete this.timeoutActions[sphereId][stoneId].clearTimeout;
    };

    let clearRSSICallback = () => {
      this.store.dispatch({
        type: 'UPDATE_STONE_RSSI',
        sphereId: sphereId,
        stoneId: stoneId,
        data: {rssi: -1000}
      });
      this.timeoutActions[sphereId][stoneId].clearRSSITimeout = undefined;
      delete this.timeoutActions[sphereId][stoneId].clearRSSITimeout;
    };

    this.timeoutActions[sphereId][stoneId].clearTimeout = Scheduler.scheduleCallback(disableCallback, DISABLE_TIMEOUT, "disable_" + stoneId + "_");
    this.timeoutActions[sphereId][stoneId].clearRSSITimeout = Scheduler.scheduleCallback(clearRSSICallback, RSSI_TIMEOUT, "updateRSSI_" + stoneId + "_");
  }

}

export const StoneStateHandler = new StoneStateHandlerClass();