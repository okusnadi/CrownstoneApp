import { getRoomContentFromState } from '../util/dataUtil'
import { NativeEventsBridge } from '../native/NativeEventsBridge'
import { CROWNSTONE_SERVICEDATA_UUID } from '../ExternalConfig'
import { LOG } from '../logging/Log'

// export const reactToEnterRoom = function(store, locationId) {
//   checkBehaviour(store, locationId, 'onRoomEnter');
// };
// export const reactToExitRoom = function(store, locationId) {
//   checkBehaviour(store, locationId, 'onRoomExit');
// };
//
// function checkBehaviour(store, locationId, type) {
//   const state = store.getState();
//   const activeSphere = state.app.activeSphere;
//   const locations = state.spheres[activeSphere].locations;
//   const locationIds = Object.keys(locations);
//   const location = locations[locationId];
//
//   if (location === undefined) {
//     LOG("COULD NOT GET LOCATION", locationId);
//     return;
//   }
//   const userId = state.user.userId;
//   const devices = getRoomContentFromState(state, activeSphere, locationId);
//
//   if (type === "onRoomExit") {
//     if (locations[locationId].presentUsers.indexOf(userId) !== -1) {
//       store.dispatch({type:"USER_EXIT", sphereId: activeSphere, locationId: locationId, data:{userId: userId}})
//     }
//   }
//   else if (type === "onRoomEnter") {
//
//     // remove user from other rooms SHOULD NOT BE NEEDED.
//     // locationIds.forEach((otherLocationId) => {
//     //   if (otherLocationId !== locationId) {
//     //     if (locations[otherLocationId].presentUsers.indexOf(userId) !== -1) {
//     //       store.dispatch({type: "USER_EXIT", sphereId: activeSphere, locationId: otherLocationId, data: {userId: userId}})
//     //     }
//     //   }
//     // });
//     // add user to rooms
//     if (locations[locationId].presentUsers.indexOf(userId) === -1) {
//       LOG("dispatching user enter event in", activeSphere, locationId, userId);
//       store.dispatch({type:"USER_ENTER", sphereId: activeSphere, locationId: locationId, data:{userId: userId}})
//     }
//   }
//
//   let stoneIds = Object.keys(devices);
//
//   stoneIds.forEach((stoneId) => {
//     let device = devices[stoneId].device;
//     let stone = devices[stoneId].stone;
//     let behaviour = device.behaviour[type];
//     //LOG("switching to ",behaviour, devices, stoneId)
//     if (behaviour.active === true) {
//     //if (behaviour.active === true && behaviour.state !== stone.state.state) {
//       let bleState = behaviour.state;
//       setTimeout(() => {setBehaviour(stone.config.uuid, bleState, type, stoneId);}, behaviour.delay*1000);
//     }
//   });
// }



class AdvertisementManagerClass {
  constructor() {
    this.stones = {};
    this.windowSize = 40;
    this.storeReference = undefined;
  }

  loadStore(store) {
    this.storeReference = store;
  }

  resetData(serviceData) {
    if (serviceData.crownstoneId) {
      let id = serviceData.crownstoneId;

      let state = this.storeReference.getState();
      let sphereId = state.app.activeSphere;
      this.storeReference.dispatch({
        type: 'UPDATE_STONE_STATE',
        sphereId: sphereId,
        stoneId: id,
        data: {currentUsage:0}
      });


      let newData = [];
      for (let i = 0; i < this.windowSize; i++) {
        newData.push(undefined);
      }
      this.stones[id] = {index: 0, data: newData, updateTime: 0};
    }
  }

  getPower(serviceData) {
    if (serviceData.crownstoneId && serviceData.powerUsage) {
      let id = serviceData.crownstoneId;
      // no negative usage
      let usage = Math.max(0,serviceData.powerUsage);
      if (usage < 10) {
        usage = 0;
      }

      if (this.stones[id] === undefined) {
        let newData = [];
        for (let i = 0; i < this.windowSize; i++) {
          newData.push(undefined);
        }
        this.stones[id] = {index: 0, data: newData, updateTime: 0};
      }
      let stone = this.stones[id];

      stone.data[stone.index] = usage;
      stone.index = (stone.index+1) % this.windowSize;
      let mean = this.getMean(stone.data);
      let meanDirty = mean;
      let std = this.getStd(stone.data, mean);

      let dataWithoutOutliers = this.filterData(stone.data, mean, std);
      let meanClean = undefined;
      if (dataWithoutOutliers.length > 0) {
        mean = this.getMean(dataWithoutOutliers);
        meanClean = mean;
      }
      else {
        // LOG("no data without outliers, not using filtered data", mean, std)
      }

      return {mean: Math.round(mean), debug: {data:JSON.stringify(stone.data), cleanData:JSON.stringify(dataWithoutOutliers), meanDirty: meanDirty, meanClean: meanClean, std: std, dirtyCount: stone.data.length, cleanCount:dataWithoutOutliers.length}};
    }
    return 0;
  }

  filterData(data, mean, std) {
    let filteredData = [];
    for (let i = 0; i < data.length; i++) {
      if (data[i] !== undefined) {
        if (Math.abs(data[i] - mean) < 1 * std) {
          filteredData.push(data[i])
        }
      }
    }
    return filteredData;
  }

  getMean(data) {
    let total = 0;
    let count = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] !== undefined) {
        total += data[i];
        count += 1;
      }
    }
    return total / count;
  }

  getStd(data, mean) {
    let total = 0;
    let count = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] !== undefined) {
        total += Math.pow(data[i] - mean, 2);
        count += 1;
      }
    }
    return Math.sqrt(total/count);
  }
}

export const AdvertisementManager = new AdvertisementManagerClass();


export const processScanResponse = function(store, packet = {}) {
  if (packet) {
    packet = JSON.parse(packet);
  }

  if (packet.isCrownstone === true) {
    const state = store.getState();
    const activeSphere = state.app.activeSphere;

    let serviceData = packet.serviceData[CROWNSTONE_SERVICEDATA_UUID];
    let stoneId = serviceData.crownstoneId;
    let stone = state.spheres[activeSphere].stones[stoneId];

    // break if a different thing is scanned
    if (stone === undefined) {
      return;
    }

    // self repairing mechanism for crownstones with updated or lost uuid.
    // if (stone.config.uuid !== packet.id) {
    //   LOG("RESTORING ID FOR ", stoneId , " TO ", packet.id);
    //   store.dispatch({
    //     type: "UPDATE_STONE_CONFIG",
    //     sphereId: activeSphere,
    //     stoneId: stoneId,
    //     data: {uuid: packet.id}
    //   })
    // }

    let locationName = state.spheres[activeSphere].locations[stone.config.locationId].config.name;
    let currentUsage = stone.state.currentUsage;
    //if (serviceData.switchState == 0) {
    //  AdvertisementManager.resetData(serviceData);
    //}

    let powerUsageFull = AdvertisementManager.getPower(serviceData);
    let powerUsage = powerUsageFull.mean;
    let rawPowerUsage = serviceData.powerUsage;
    if (serviceData.switchState == 0) {
      powerUsage = 0;
    }

    // LOG("GOT FROM BLE", locationName, serviceData);

    // abide by the update time.
    // if (Math.round(stone.state.state * 255) !== serviceData.switchState) {
    //   LOG("SETTING SWITCH STATE for state", stone.state.state, serviceData, " in: ", locationName);
    //   store.dispatch({
    //     type: "UPDATE_STONE_STATE",
    //     sphereId: activeSphere,
    //     stoneId: stoneId,
    //     data: {state: serviceData.switchState / 255, currentUsage: Math.max(0, serviceData.powerUsage)}
    //   })
    // }
    // else if (Math.abs(powerUsage - powerUsage) > 1) {
    //   LOG("SETTING SWITCH STATE for power", powerUsage - serviceData.powerUsage, powerUsage, " in: ", locationName);
    //   store.dispatch({
    //     type: "UPDATE_STONE_STATE",
    //     sphereId: activeSphere,
    //     stoneId: stoneId,
    //     data: {state: serviceData.switchState / 255, currentUsage: powerUsage}
    //   })
    // }

    if (stone.state.state !== serviceData.switchState) {
        // LOG("SETTING SWITCH STATE due to cs:",packet.name," for state", stone.state.state, serviceData, " in: ", locationName);
        store.dispatch({
          type: "UPDATE_STONE_STATE",
          sphereId: activeSphere,
          stoneId: stoneId,
          data: {state: serviceData.switchState, currentUsage: powerUsage}
        })
      }
      else if (Math.abs(powerUsage - currentUsage) > 2) {
        LOG("SETTING POWER USAGE due to cs:",packet.name ," for power diff:", powerUsage - currentUsage, " from current: ", currentUsage, "measured:",powerUsage,"raw:",rawPowerUsage,"data:",powerUsageFull, "in: ", locationName);
        store.dispatch({
          type: "UPDATE_STONE_STATE",
          sphereId: activeSphere,
          stoneId: stoneId,
          data: {state: serviceData.switchState, currentUsage: powerUsage}
        })
      }
  }
};








































