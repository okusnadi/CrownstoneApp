import { Scheduler } from '../../logic/Scheduler';
import { NativeBus } from '../libInterface/NativeBus';
import { StoneStateHandler } from './StoneStateHandler'
import { LOG } from '../../logging/Log'
import { HARDWARE_ERROR_REPORTING, LOG_BLE } from '../../ExternalConfig'
import { eventBus }  from '../../util/EventBus'
import { Util }  from '../../util/Util'
import { MapProvider } from "../../backgroundProcesses/MapProvider";
import {LogProcessor} from "../../logging/LogProcessor";
import {LOG_LEVEL} from "../../logging/LogLevels";

let TRIGGER_ID = 'CrownstoneAdvertisement';
let ADVERTISEMENT_PREFIX =  "updateStoneFromAdvertisement_";

class AdvertisementHandlerClass {
  _initialized : any;
  store : any;
  stonesInConnectionProcess : any;
  temporaryIgnore  : any;
  temporaryIgnoreTimeout : any;
  listeners = [];

  constructor() {
    this._initialized = false;
    this.store = undefined;
    this.stonesInConnectionProcess = {};
    this.temporaryIgnore = false;
    this.temporaryIgnoreTimeout = undefined;
  }

  _loadStore(store) {
    LOG.info('LOADED STORE AdvertisementHandler', this._initialized);
    if (this._initialized === false) {
      this.store = store;
      this.init();
    }
  }

  init() {
    if (this._initialized === false) {
      // make sure we clear any pending advertisement package updates that are scheduled for this crownstone
      eventBus.on("connect", (handle) => {
        Scheduler.clearOverwritableTriggerAction(TRIGGER_ID, ADVERTISEMENT_PREFIX + handle);
        // this is a fallback mechanism in case no disconnect event is fired.
        this.stonesInConnectionProcess[handle] = {timeout: Scheduler.scheduleCallback(() => {
          LOG.warn("(Ignore if doing setup) Force restoring listening to all crownstones since no disconnect state after 15 seconds.");
          this._restoreConnectionTimeout();
        }, 15000, 'ignoreProcessAdvertisementsTimeout')};
      });

      // sometimes the first event since state change can be wrong, we use this to ignore it.
      eventBus.on("disconnect", () => {
        // wait before listening to the stones again.
        Scheduler.scheduleCallback(() => {this._restoreConnectionTimeout();}, 1000,'_restoreConnectionTimeout');
      });

      // sometimes the first event since state change can be wrong, we use this to ignore it.
      eventBus.on("databaseChange", (data) => {
        let change = data.change;
        if  (change.changeDeveloperData || change.changeUserDeveloperStatus) {
          this._reloadListeners();
        }
      });

      // sometimes we need to ignore any trigger for switching because we're doing something else.
      eventBus.on("ignoreTriggers", () => {
        this.temporaryIgnore = true;
        this.temporaryIgnoreTimeout = Scheduler.scheduleCallback(() => {
          if (this.temporaryIgnore === true) {
            LOG.error("Temporary ignore of triggers has been on for more than 20 seconds!!");
          }
        }, 20000, 'temporaryIgnoreTimeout');
      });
      eventBus.on("useTriggers", () => {
        this.temporaryIgnore = false;
        if (typeof this.temporaryIgnoreTimeout === 'function') {
          this.temporaryIgnoreTimeout();
          this.temporaryIgnoreTimeout = null;
        }
      });

      // create a trigger to throttle the updates.
      Scheduler.setRepeatingTrigger(TRIGGER_ID,{repeatEveryNSeconds:2});

      // listen to verified advertisements. Verified means consecutively successfully encrypted.
      NativeBus.on(NativeBus.topics.advertisement, this.handleEvent.bind(this));

      this._reloadListeners();

      this._initialized = true;
    }
  }

  _reloadListeners() {
    // Debug logging of all BLE related events.
    if (LOG_BLE || LogProcessor.log_ble) {
      LOG.ble("Subscribing to all BLE Topics");
      if (this.listeners.length > 0) {
        this.listeners.forEach((unsubscribe) => { unsubscribe(); });
      }
      this.listeners = [];

      this.listeners.push(NativeBus.on(NativeBus.topics.setupAdvertisement, (data) => {
        LOG.ble('setupAdvertisement', data.name, data.rssi, data.handle, data);
      }));
      this.listeners.push(NativeBus.on(NativeBus.topics.advertisement, (data) => {
        LOG.ble('crownstoneId', data.name, data.rssi, data.handle, data);
      }));
      this.listeners.push(NativeBus.on(NativeBus.topics.iBeaconAdvertisement, (data) => {
        LOG.ble('iBeaconAdvertisement', data[0].rssi, data[0].major, data[0].minor, data);
      }));
      this.listeners.push(NativeBus.on(NativeBus.topics.dfuAdvertisement, (data) => {
        LOG.ble('dfuAdvertisement', data);
      }));
    }
  }

  _restoreConnectionTimeout() {
    Object.keys(this.stonesInConnectionProcess).forEach((handle) => {
      if (typeof this.stonesInConnectionProcess[handle].timeout === 'function') {
        this.stonesInConnectionProcess[handle].timeout();
        this.stonesInConnectionProcess[handle].timeout = null;
      }
    });
    this.stonesInConnectionProcess = {};
  }

  handleEvent(advertisement : crownstoneAdvertisement) {
    // ignore stones that we are attempting to connect to.
    if (this.stonesInConnectionProcess[advertisement.handle] !== undefined) {
      LOG.debug("AdvertisementHandler: IGNORE: connecting to stone.");
      return;
    }

    // the service data in this advertisement;
    let serviceData : crownstoneServiceData = advertisement.serviceData;
    let state = this.store.getState();

    // service data not available
    if (typeof serviceData !== 'object') {
      LOG.debug("AdvertisementHandler: IGNORE: serviceData is no object.");
      return;
    }

    // check if we have a state
    if (state.spheres === undefined) {
      LOG.debug("AdvertisementHandler: IGNORE: We have no spheres.");
      return;
    }

    // only relevant if we are in a sphere.
    if (state.spheres[advertisement.referenceId] === undefined) {
      LOG.debug("AdvertisementHandler: IGNORE: This specific sphere is unknown to us.");
      return;
    }

    let sphereId = advertisement.referenceId;

    // look for the crownstone in this sphere which has the same CrownstoneId (CID)
    let referenceByCrownstoneId = MapProvider.stoneCIDMap[sphereId][serviceData.crownstoneId];

    // check if we have a Crownstone with this CID, if not, ignore it.
    if (referenceByCrownstoneId === undefined) {
      return;
    }

    // repair mechanism to store the handle.
    if (serviceData.stateOfExternalCrownstone === false && referenceByCrownstoneId !== undefined) {
      if (referenceByCrownstoneId.handle != advertisement.handle) {
        LOG.debug("AdvertisementHandler: IGNORE: Store handle in our database so we can use the next advertisement.");
        this.store.dispatch({type: "UPDATE_STONE_HANDLE", sphereId: advertisement.referenceId, stoneId: referenceByCrownstoneId.id, data:{handle: advertisement.handle}});
        return;
      }
    }

    let referenceByHandle = MapProvider.stoneSphereHandleMap[sphereId][advertisement.handle];

    // unknown crownstone
    if (referenceByHandle === undefined) {
      return;
    }

    let stoneFromServiceData   = state.spheres[advertisement.referenceId].stones[referenceByCrownstoneId.id];
    let stoneFromAdvertisement = state.spheres[advertisement.referenceId].stones[referenceByHandle.id];


    // handle the case of a failed DFU that requires a reset. If it boots in normal mode, we can not use it until the
    // reset is complete.
    if (stoneFromAdvertisement.config.dfuResetRequired === true) {
      LOG.debug('AdvertisementHandler: IGNORE: DFU reset is required for this Crownstone.');
      return;
    }

    // --------------------- Pass errors to error Watcher --------------------------- //
    if (HARDWARE_ERROR_REPORTING) {
      if (advertisement.serviceData.hasError === true) {
        LOG.info("GOT ERROR", advertisement.serviceData);
        eventBus.emit("errorDetectedInAdvertisement", {
          advertisement: advertisement,
          stone: stoneFromServiceData,
          stoneId: referenceByCrownstoneId.id,
          sphereId: advertisement.referenceId
        });
      }
      else if (stoneFromServiceData.errors.advertisementError === true) {
        LOG.info("GOT NO ERROR WHERE THERE WAS AN ERROR BEFORE", advertisement.serviceData);
        eventBus.emit("errorResolvedInAdvertisement", {
          advertisement: advertisement,
          stone: stoneFromServiceData,
          stoneId: referenceByCrownstoneId.id,
          sphereId: advertisement.referenceId
        });
      }
    }
    // --------------------- /handle errors --------------------------- //


    // --------------------- Update the Mesh Network --------------------------- //

    // update mesh network map.
    let meshNetworkId = undefined;
    if (serviceData.stateOfExternalCrownstone === true) {
      let meshNetworkId_external = stoneFromServiceData.config.meshNetworkId;
      let meshNetworkId_advertiser = stoneFromAdvertisement.config.meshNetworkId;

      // initially it does not matter which we select.
      meshNetworkId = meshNetworkId_advertiser;

      // if these stones are not known to be in a mesh network, they are in the same, new, network.
      if (meshNetworkId_external === null && meshNetworkId_advertiser === null) {
        meshNetworkId = Math.round(Math.random()*1e6);
        let actions = [];
        actions.push(Util.mesh.getChangeMeshIdAction(sphereId, referenceByCrownstoneId.id, meshNetworkId));
        actions.push(Util.mesh.getChangeMeshIdAction(sphereId, referenceByHandle.id, meshNetworkId));
        this.store.batchDispatch(actions);
      }
      // if they are in a different mesh network, place them in the same one.
      else if (meshNetworkId_external !== meshNetworkId_advertiser) {
        if (meshNetworkId_external === null) {
          // copy mesh id from stoneFromAdvertisement to stoneFromServiceData
          meshNetworkId = meshNetworkId_advertiser;
          this.store.dispatch(Util.mesh.getChangeMeshIdAction(sphereId, referenceByCrownstoneId.id, meshNetworkId));
        }
        else if (meshNetworkId_advertiser === null) {
          // copy mesh id from stoneFromServiceData to stoneFromAdvertisement
          meshNetworkId = meshNetworkId_external;
          this.store.dispatch(Util.mesh.getChangeMeshIdAction(sphereId, referenceByHandle.id, meshNetworkId));
        }
        else {
          // copy the mesh id from the largest mesh to the smallest mesh
          let state = this.store.getState();
          let stonesInNetwork_external = Util.mesh.getStonesInNetwork(state, sphereId, meshNetworkId_external);
          let stonesInNetwork_advertiser = Util.mesh.getStonesInNetwork(state, sphereId, meshNetworkId_advertiser);

          if (stonesInNetwork_external.length > stonesInNetwork_advertiser.length) {
            meshNetworkId = meshNetworkId_external;
            Util.mesh.setNetworkId(this.store, sphereId, stonesInNetwork_advertiser, meshNetworkId);
          }
          else {
            meshNetworkId = meshNetworkId_external;
            Util.mesh.setNetworkId(this.store, sphereId, stonesInNetwork_external, meshNetworkId);
          }
        }
      }
    }

    // ----------------- END Update the Mesh Network END ----------------------- //



    let measuredUsage = Math.floor(serviceData.powerUsage * 0.001);  // usage is in milli Watts

    let currentTime = new Date().valueOf();

    let switchState = Math.min(1,serviceData.switchState / 100);

    // small aesthetic fix: force no measurement when its supposed to be off.
    if (switchState === 0 && measuredUsage !== 0) {
      measuredUsage = 0;
    }

    // hide negative measurements from the user
    if (measuredUsage < 0) {
      measuredUsage = 0;
    }

    // sometimes we need to ignore any distance based toggling.
    if (this.temporaryIgnore !== true) {
      Scheduler.loadOverwritableAction(TRIGGER_ID,  ADVERTISEMENT_PREFIX + advertisement.handle, {
        type: 'UPDATE_STONE_STATE',
        sphereId: advertisement.referenceId,
        stoneId: referenceByCrownstoneId.id,
        data: { state: switchState, currentUsage: measuredUsage, applianceId: referenceByCrownstoneId.applianceId },
        updatedAt: currentTime,
        __logLevel: LOG_LEVEL.verbose, // this command only lets this log skip the LOG.store unless LOG_VERBOSE is on.
      });
    }


    // if the advertisement contains the state of a different Crownstone, we update its disability state
    if (serviceData.stateOfExternalCrownstone === true) {
      StoneStateHandler.receivedUpdateViaMesh(sphereId, referenceByCrownstoneId.id, meshNetworkId, serviceData.random, referenceByHandle.id, serviceData);
    }

    // we always update the disability (and rssi) of the Crownstone that is broadcasting.
    StoneStateHandler.receivedAdvertisementUpdate(sphereId, stoneFromAdvertisement, referenceByHandle.id, advertisement.rssi);
  }
}

export const AdvertisementHandler : any = new AdvertisementHandlerClass();


