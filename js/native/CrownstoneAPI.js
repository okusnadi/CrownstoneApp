import { NativeBridge } from './NativeBridge'

class CrownstoneAPIClass {
  constructor() {
    NativeBridge.BleEvents.on('statusUpdate',               (data) => {this._makeUnique(data); this._updateCrownstones(data, this.activeCrownstones)});
    NativeBridge.BleEvents.on('foundCrownstoneInSetupMode', (data) => {this._makeUnique(data); this._updateCrownstones(data, this.setupModeCrownstones)});
    NativeBridge.BleEvents.on('foundCrownstoneInDFUMode',   (data) => {this._makeUnique(data); this._updateCrownstones(data, this.dfuModeCrownstones)});
    this.dfuModeCrownstones = {};
    this.setupModeCrownstones = {};
    this.activeCrownstones = {};
  }



  _updateCrownstones(data, container) {
    if (container[data.handle] === undefined) {
      container[data.handle] = {RSSI: data.RSSI, timeout:undefined};
    }
    else if (container[data.handle].timeout !== undefined) {
      clearTimeout(container[data.handle].timeout)
    }

    let cs = container[data.handle];
    cs.RSSI = cs.RSSI*0.8 + cs.RSSI*0.2;
    cs.timeout = setTimeout(() => {delete container[data.handle]}, 5000);
  }

  /**
   * This method ensures that a crownstone is in only one collection at the time
   * @param data
   */
  _makeUnique(data) {
    if (data.type === 'statusUpdate') {
      delete this.setupModeCrownstones[data.handle];
      delete this.dfuModeCrownstones[data.handle];
    }
    else if (data.type === 'setup') {
      delete this.dfuModeCrownstones[data.handle];
      delete this.activeCrownstones[data.handle];
    }
    else if (data.type === 'dfu') {
      delete this.setupModeCrownstones[data.handle];
      delete this.activeCrownstones[data.handle];
    }
  }

  /**
   * Based on RSSI get the nearest crownstone from the container.
   * @param container --> either this.dfuModeCrownstones, this.setupModeCrownstones or this.activeCrownstones
   * @returns {*}
   * @private
   */
  _getNearestCrownstone(container) {
    let stoneIds = Object.keys(container);
    if (stoneIds.length === 1) {
      return container[stoneIds[0]];
    }
    else if (stoneIds.length > 0) {
      let rssiSorted = [];
      stoneIds.forEach((stoneId) => {
        rssiSorted.push({id: stoneId, RSSI: container[stoneId].RSSI});
      });
      rssiSorted.sort((a, b) => {return a.RSSI - b.RSSI;});
      // rssi is negative!
      return rssiSorted[0].id;
    }
    else {
      return undefined;
    }
  }


  getNearestSetupCrownstone() {
    return new Promise((resolve, reject) => {
      setTimeout(() => {resolve(new SetupCrownstone(123));},1000);
    })
  }
//
//     return new Promise((resolve, reject) => {
//       let stoneId = this._getNearestCrownstone(this.setupModeCrownstones);
//       if (stoneId !== undefined)
//         resolve(new SetupCrownstone(stoneId));
//       else {
//         // if it fails we try again in 2 seconds... if that fails, we reject the promise.
//         setTimeout(() => {
//           let stoneId = this._getNearestCrownstone(this.setupModeCrownstones);
//           if (stoneId !== undefined)
//             resolve(new SetupCrownstone(stoneId));
//           else
//             reject({type:'NO_SETUP_CROWNSTONE'});
//         },5000)
//       }
//     });
//   }

};


export const CrownstoneAPI = { getNearestSetupCrownstone: function() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {resolve(new SetupCrownstone(123));},1000);
  })
}}

export class SetupCrownstone {
  constructor(handleId) {
    this.handleId = handleId;
  }

  connect() {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, 1000)
    });
  }

  makeNoise() {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, 400)
    });
  }

  getMacAddress() {
    return new Promise((resolve, reject) => {
      setTimeout(() => {resolve('abcde')}, 1000)
    });
    // return NativeBridge.getMacAddress();
  }

  getBluetoothId() {
    // android: MAC, iOS: UUID
    return "bluetoothaddress"
  }

  writeId(id) {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, 400)
    });
  }

  writeAdminKey(adminkey) {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, 400)
    });
  }
  writeUserKey(userkey) {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, 400)
    });
  }
  writeGuestKey(guestkey) {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, 400)
    });
  }
  writeMeshAccessAddress(accessAddress) {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, 400)
    });
  }
  
  writeIBeaconUUID(uuid) {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, 400)
    });
  }

  writeIBeaconMajor(major) {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, 400)
    });
  }

  writeIBeaconMinor(minor) {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, 400)
    });
  }

  activate() {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, 2000)
    });
  }

  reset() {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, 2000)
    });
  }
}