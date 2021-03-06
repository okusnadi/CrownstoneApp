import * as React from 'react'; import { Component } from 'react';
import {
  Alert,
  Linking,
  PixelRatio,
  ScrollView,
  Switch,
  TextInput,
  Text,
  TouchableHighlight,
  TouchableOpacity,
  View
} from 'react-native';
const Actions = require('react-native-router-flux').Actions;

import { STONE_TYPES } from '../../router/store/reducers/stones'
import { styles, colors, screenWidth, screenHeight } from '../styles'
import { BluenetPromiseWrapper } from '../../native/libInterface/BluenetPromise'
import { BleUtil } from '../../util/BleUtil'
import { CLOUD } from '../../cloud/cloudAPI'
import { IconButton } from '../components/IconButton'
import { Background } from '../components/Background'
import { ListEditableItems } from '../components/ListEditableItems'
import { FadeInView } from '../components/animated/FadeInView'
import { LOG } from '../../logging/Log'
import {DIMMING_ENABLED} from "../../ExternalConfig";
import {Permissions} from "../../backgroundProcesses/PermissionManager";



export class DeviceEdit extends Component<any, any> {
  deleting : boolean = false;
  unsubscribeStoreEvents : any;

  constructor() {
    super();
    this.state = {showStone:false};
  }

  componentDidMount() {
    const { store } = this.props;

    // tell the component exactly when it should redraw
    this.unsubscribeStoreEvents = this.props.eventBus.on("databaseChange", (data) => {
      let change = data.change;
      let state = store.getState();

      // in case the sphere is deleted
      if (state.spheres[this.props.sphereId] === undefined) {
        Actions.pop();
        return;
      }

      if (
        change.updateStoneConfig && change.updateStoneConfig.stoneIds[this.props.stoneId] ||
        change.updateApplianceConfig
        ) {
        if (this.deleting === false) {
          this.forceUpdate();
        }
      }
    });
  }

  componentWillUnmount() {
    this.unsubscribeStoreEvents();
  }



  constructStoneOptions(store, state, stone) {
    let appliance = null;
    let applianceId = stone.config.applianceId;
    if (stone.config.applianceId) {
      appliance = state.spheres[this.props.sphereId].appliances[stone.config.applianceId];
    }

    let requiredData = {
      sphereId: this.props.sphereId,
      stoneId: this.props.stoneId,
    };
    let items = [];

    if (appliance) {
      items.push({label:'PLUGGED IN DEVICE TYPE', type: 'explanation',  below:false});
      items.push({
        label: 'Device Type', type: 'textEdit', placeholder:'Pick a name', value: appliance.config.name, callback: (newText) => {
          store.dispatch({...requiredData, applianceId: applianceId, type: 'UPDATE_APPLIANCE_CONFIG', data: {name: newText}});
        }
      });

      // icon picker
      items.push({label:'Icon', type: 'icon', value: appliance.config.icon, callback: () => {
        Actions.deviceIconSelection({applianceId: applianceId, stoneId: this.props.stoneId, icon: appliance.config.icon, sphereId: this.props.sphereId})
      }});

      // unplug device
      items.push({
        label: 'Decouple Device Type',
        type: 'button',
        icon: <IconButton name="c1-socket2" size={22} button={true} color="#fff" buttonStyle={{backgroundColor:colors.blue.hex}} />,
        style: {color: colors.blue.hex},
        callback: () => {
          this.setState({showStone:true});
          setTimeout(() => {store.dispatch({...requiredData, applianceId: applianceId, type: 'UPDATE_STONE_CONFIG', data: {applianceId: null}});}, 300);
        }
      });
      items.push({label:'This Crownstone is currently using the behaviour, name and icon of this device type. Decoupling it will revert the behaviour back to the empty Crownstone configuration.', type: 'explanation',  below:true});
    }


    if (appliance) {
      items.push({label: 'CURRENT CROWNSTONE USING THIS TYPE', type: 'explanation', below: false});
    }
    else {
      items.push({label: 'CROWNSTONE', type: 'explanation', below: false});
    }
    items.push({
      label: 'Name', type: 'textEdit', placeholder:'Choose a nice name', value: stone.config.name, callback: (newText) => {
        store.dispatch({...requiredData, type: 'UPDATE_STONE_CONFIG', data: {name: newText}});
      }
    });

    if (DIMMING_ENABLED) {
      items.push({
        label: 'Allow Dimming', type: 'switch', value: stone.config.dimmingEnabled === true, callback: (newValue) => {
          store.dispatch({...requiredData, type: 'UPDATE_STONE_CONFIG', data: {dimmingEnabled: newValue}});
        }
      });
      items.push({
        label: 'View Dimming Compatibility', type: 'navigation', callback: () => {
          Linking.openURL('https://crownstone.rocks/compatibility/dimming/').catch(err => {
          })
        }
      });
      items.push({
        label: 'Dimming can be enabled per Crownstone. It is up to you to make sure you are not dimming anything other than lights. To do so is at your own risk.',
        type: 'explanation',
        below: true
      });
    }

    if (stone.config.type !== STONE_TYPES.guidestone && !applianceId) {
      items.push({label: 'SELECT WHICH DEVICE TYPE IS PLUGGED IN', type: 'explanation', below: false});
      items.push({
        label: 'Select...', type: 'navigation', labelStyle: {color: colors.blue.hex}, callback: () => {
          Actions.applianceSelection({
            ...requiredData,
            callback: (applianceId) => {
              this.setState({showStone:false});
              store.dispatch({...requiredData, type: 'UPDATE_STONE_CONFIG', data: {applianceId: applianceId}});
            }
          });
        }
      });
      items.push({
        label: 'A Device Type has it\'s own configuration and behaviour so you can set up once and quickly apply it to one or multiple Crownstones.',
        type: 'explanation',
        below: true
      });
    }

    if (Permissions.inSphere(this.props.sphereId).removeCrownstone) {
      items.push({
        label: 'Remove from Sphere',
        icon: <IconButton name="ios-trash" size={22} button={true} color="#fff" buttonStyle={{backgroundColor:colors.red.hex}} />,
        type: 'button',
        callback: () => {
          Alert.alert(
            "Are you sure?",
            "Removing a Crownstone from the sphere will revert it to it's factory default settings.",
            [{text: 'Cancel', style: 'cancel'}, {text: 'Remove', style:'destructive', onPress: () => {
              if (stone.config.disabled === true) {
                Alert.alert("Can't see this one!",
                  "This Crownstone has not been seen for a while.. Can you move closer to it and try again? If you want to remove it from your Sphere without resetting it, press Delete anyway.",
                  [{text:'Delete anyway', onPress: () => {this._removeCloudOnly()}, style: 'destructive'},
                    {text:'Cancel',style: 'cancel', onPress: () => {this.props.eventBus.emit('hideLoading');}}]
                )
              }
              else {
                this.props.eventBus.emit('showLoading', 'Looking for the Crownstone...');
                this._removeCrownstone(stone);
              }
            }}]
          )
        }
      });
      items.push({label:'Removing this Crownstone from its Sphere will revert it back to factory defaults (and back in setup mode).',  type:'explanation', below:true});
    }

    return items;
  }


  _removeCrownstone(stone) {
    return new Promise((resolve, reject) => {
      BleUtil.detectCrownstone(stone.config.handle)
        .then((isInSetupMode) => {
          // if this crownstone is broadcasting but in setup mode, we only remove it from the cloud.
          if (isInSetupMode === true) {
            this._removeCloudOnly();
          }
          this._removeCloudReset(stone);
        })
        .catch((err) => {
          Alert.alert("Can't see this one!",
            "We can't find this Crownstone while scanning. Can you move closer to it and try again? If you want to remove it from your Sphere without resetting it, press Delete anyway.",
            [{text:'Delete anyway', onPress: () => {this._removeCloudOnly()}, style: 'destructive'},
              {text:'Cancel',style: 'cancel', onPress: () => {this.props.eventBus.emit('hideLoading');}}])
        })
    })
  }


  _removeCloudOnly() {
    this.props.eventBus.emit('showLoading', 'Removing the Crownstone from the Cloud...');
    CLOUD.forSphere(this.props.sphereId).deleteStone(this.props.stoneId)
      .catch((err) => {
        return new Promise((resolve, reject) => {
          if (err && err.status === 404) {
            resolve();
          }
          else {
            LOG.error("COULD NOT DELETE IN CLOUD", err);
            reject();
          }
        })
      })
      .then(() => {
        this._removeCrownstoneFromRedux(false);
      })
      .catch((err) => {
        LOG.info("error while asking the cloud to remove this crownstone", err);
        this.props.eventBus.emit('hideLoading');
        Alert.alert("Encountered Cloud Issue.",
          "We cannot delete this Crownstone in the cloud. Please try again later",
          [{text:'OK'}])
      })
  }


  _removeCloudReset(stone) {
    this.props.eventBus.emit('showLoading', 'Removing the Crownstone from the Cloud...');
    CLOUD.forSphere(this.props.sphereId).deleteStone(this.props.stoneId)
      .catch((err) => {
        return new Promise((resolve, reject) => {
          if (err && err.status === 404) {
            resolve();
          }
          else {
            LOG.error("COULD NOT DELETE IN CLOUD", err);
            reject();
          }
        })
      })
      .then(() => {
        this.props.eventBus.emit('showLoading', 'Factory resetting the Crownstone...');
        let proxy = BleUtil.getProxy(stone.config.handle, this.props.sphereId, this.props.stoneId);
        proxy.performPriority(BluenetPromiseWrapper.commandFactoryReset)
          .catch(() => {
            // second attempt
            return proxy.performPriority(BluenetPromiseWrapper.commandFactoryReset)
          })
          .then(() => {
            this._removeCrownstoneFromRedux(true);
          })
          .catch((err) => {
            LOG.error("ERROR:",err);
            Alert.alert("Encountered a problem.",
              "We cannot Factory reset this Crownstone. Unfortunately, it has already been removed from the cloud. " +
              "Try deleting it again or use the recovery procedure to put it in setup mode.",
              [{text:'OK', onPress: () => {
                this.props.eventBus.emit('hideLoading');
                Actions.pop();
              }}]
            )
          })
      })
      .catch((err) => {
        LOG.info("error while asking the cloud to remove this crownstone", err);
        Alert.alert("Encountered Cloud Issue.",
          "We cannot delete this Crownstone in the cloud. Please try again later",
          [{text:'OK', onPress: () => {
            this.props.eventBus.emit('hideLoading');}
          }])
      })
  }


  _removeCrownstoneFromRedux(factoryReset = false) {
    // deleting makes sure we will not draw this page again if we delete it's source from the database.
    this.deleting = true;

    let labelText = "I have removed this Crownstone from the Cloud, your Sphere and reverted it to factory defaults. After plugging it in and out once more, you can freely add it to a Sphere.";
    if (factoryReset === false) {
     labelText = "I have removed this Crownstone from the Cloud and your Sphere. I could not reset it back to setup mode though.. You'll need to recover it to put it back into setup mode."
    }

    Alert.alert("Success!", labelText,
      [{text:'OK', onPress: () => {
        this.props.eventBus.emit('hideLoading');
        Actions.pop();
        this.props.store.dispatch({type: "REMOVE_STONE", sphereId: this.props.sphereId, stoneId: this.props.stoneId});
      }}]
    )
  }


  _getVersionInformation(stone) {
    let unknownString = "Not checked.";
    return (
      <View style={{paddingTop:15, paddingBottom:30}}>
        <Text style={styles.version}>{'hardware: '   + (stone.config.hardwareVersion || unknownString)}</Text>
        <Text style={styles.version}>{'bootloader: ' + (stone.config.bootloaderVersion || unknownString)}</Text>
        <Text style={styles.version}>{'firmware: '   + (stone.config.firmwareVersion || unknownString)}</Text>
      </View>
    )
  }

  render() {
    const store = this.props.store;
    const state = store.getState();
    const stone = state.spheres[this.props.sphereId].stones[this.props.stoneId];

    let options = this.constructStoneOptions(store, state, stone);

    let backgroundImage = this.props.getBackground('menu', this.props.viewingRemotely);

    return (
      <Background image={backgroundImage} >
        <ScrollView>
          <ListEditableItems items={options} separatorIndent={true}/>
          {this._getVersionInformation(stone)}
        </ScrollView>
      </Background>
    )
  }
}
