import { Alert, Vibration } from 'react-native';

import { eventBus } from '../../util/EventBus';
import { LOG }      from '../../logging/Log';
import {Util} from "../../util/Util";

const meshRemovalThreshold : number = 200; // times not this crownstone in mesh
const meshRemovalTimeout : number = 200; // seconds

export class IndividualStoneTracker {
  unsubscribeMeshListener : any;
  meshNetworkId : number;
  stoneUID      : number;
  store         : any;
  sphereId      : string;
  stoneId       : string;

  notThisStoneCounter : number  = 0;
  timeLastSeen : number  = 0;


  constructor(store, sphereId, stoneId) {
    this.store = store;
    this.sphereId  = sphereId;
    this.stoneId = stoneId;

    this.stoneUID = store.getState().spheres[sphereId].stones[stoneId].config.crownstoneId;
    this.timeLastSeen = 0;

    this.init()
  }

  init() {
    eventBus.on("databaseChange", (data) => {
      let change = data.change;
      if ( change.meshIdUpdated && change.meshIdUpdated.stoneIds[this.stoneId] ) {
        this.updateListener();
      }
    });

    this.updateListener();
  }


  updateListener() {
    // TODO: this is a quick fix to make it not crash, fix this better.
    if (this.store.getState().spheres[this.sphereId] === undefined) {
      LOG.warn("Missing sphere:", this.sphereId);
      return;
    }
    if (this.store.getState().spheres[this.sphereId].stones[this.stoneId] === undefined) {
      LOG.warn("Missing stone:", this.stoneId);
      return;
    }
    this.meshNetworkId = this.store.getState().spheres[this.sphereId].stones[this.stoneId].config.meshNetworkId;

    // cleanup previous listener
    if (this.unsubscribeMeshListener && typeof this.unsubscribeMeshListener === 'function') {
      this.unsubscribeMeshListener();
      this.unsubscribeMeshListener = undefined;
    }

    let now = new Date().valueOf();

    // if we have a network, listen for its advertisements
    if (this.meshNetworkId !== null) {
      this.unsubscribeMeshListener = eventBus.on(Util.events.getViaMeshTopic(this.sphereId, this.meshNetworkId), (data) => {
        if (data.id === this.stoneId) {
          this.timeLastSeen = now;
          // LOG.info("PROGRESSING RESET ", this.stoneUID, " from ", this.meshNetworkId, "to ", 0);
          this.notThisStoneCounter = 0;
        }
        else {
          // LOG.info("PROGRESSING ", this.stoneUID, " from ", this.meshNetworkId, "to ", this.notThisStoneCounter);
          this.notThisStoneCounter += 1;
        }

        if (this.notThisStoneCounter >= meshRemovalThreshold && now - this.timeLastSeen > meshRemovalTimeout*1000) {
          this.removeFromMesh();
        }
      });
    }
  }

  removeFromMesh() {
    // LOG.info("Removing stone", this.stoneUID, " from ", this.meshNetworkId);
    this.notThisStoneCounter = 0;
    this.store.dispatch({
      type: 'UPDATE_MESH_NETWORK_ID',
      sphereId: this.sphereId,
      stoneId: this.stoneId,
      data: {meshNetworkId: null}
    });
    this.updateListener();
  }

}