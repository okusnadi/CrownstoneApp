import * as React from 'react'; import { Component } from 'react';
import {
  Alert,
  Dimensions,
  TouchableHighlight,
  PixelRatio,
  ScrollView,
  Switch,
  Text,
  View
} from 'react-native';

import { Background } from './../components/Background'
import { ListEditableItems } from './../components/ListEditableItems'
import { Util } from '../../util/Util'
const Actions = require('react-native-router-flux').Actions;
import { styles, colors } from './../styles'
import { TopBar } from '../components/Topbar';
import { RoomList } from '../components/RoomList';
import { Icon } from '../components/Icon';

export class RoomSelection extends Component<any, any> {
  unsubscribe : any;

  componentDidMount() {
    // tell the component exactly when it should redraw
    this.unsubscribe = this.props.eventBus.on("databaseChange", (data) => {
      let change = data.change;

      if (change.removeSphere && change["removeSphere"].sphereIds[this.props.sphereId]) {
        return Actions.pop();
      }

      if (change.changeLocations && change["changeLocations"].sphereIds[this.props.sphereId]) {
        this.forceUpdate();
      }
    });
  }

  componentWillUnmount() {
    this.unsubscribe();
  }

  _getRoomItem(store, state, requiredData, roomId, room) {
    return (
      <TouchableHighlight key={roomId + '_entry'} onPress={() => {
        Actions.pop();
        store.dispatch({...requiredData, type: "UPDATE_STONE_LOCATION", data: {locationId: roomId}})
      }}>
        <View style={[styles.listView, {paddingRight:5}]}>
          <RoomList
            icon={room.config.icon}
            name={room.config.name}
            stoneCount={Object.keys(Util.data.getStonesInLocation(state, this.props.sphereId, roomId)).length}
            navigation={true}
          />
        </View>
      </TouchableHighlight>
    )
  }

  _getItems() {
    let items = [];
    let requiredData = {sphereId: this.props.sphereId, stoneId: this.props.stoneId};

    const store = this.props.store;
    const state = store.getState();

    let rooms = state.spheres[this.props.sphereId].locations;
    let roomIds = Object.keys(rooms);
    items.push({label:"ROOMS IN CURRENT SPHERE",  type:'explanation', below:false});
    roomIds.forEach((roomId) => {
      let room = rooms[roomId];
      items.push({__item: this._getRoomItem(store, state, requiredData, roomId, room)});
    });

    items.push({
      label: 'Add a room',
      largeIcon: <Icon name="ios-add-circle" size={60} color={colors.green.hex} style={{position:'relative', top:2}} />,
      style: {color:colors.blue.hex},
      type: 'navigation',
      callback: () => {
        Actions.roomAdd({sphereId: this.props.sphereId, movingCrownstone: this.props.stoneId, fromMovingView: true})
      }
    });

    items.push({label:"DECOUPLE THIS CROWNSTONE",  type:'explanation', below: false});
    items.push({
      label: 'Not in a specific room',
      largeIcon: <Icon name="md-cube" size={50} color={colors.green.hex} style={{position:'relative', top:2}} />,
      style: {color:colors.blue.hex},
      type: 'navigation',
      callback: () => {
        Actions.pop();
        store.dispatch({...requiredData, type: "UPDATE_STONE_LOCATION", data: {locationId: null}});
      }
    });
    items.push({label:"If you do not add the Crownstone to a room, it can not be used for indoor localization purposes.",  type:'explanation', below: true});

    return items;
  }

  render() {
    let backgroundImage = this.props.getBackground('menu', this.props.viewingRemotely);
    return (
      <Background hideInterface={true} image={backgroundImage} >
        <TopBar
          leftAction={ () => { Actions.pop(); }}
          title={this.props.title} />
        <ScrollView>
          <ListEditableItems items={this._getItems()} />
        </ScrollView>
      </Background>
    );
  }
}
