import * as React from 'react'; import { Component } from 'react';
import {
  
  TouchableHighlight,
  Text,
  View
} from 'react-native';

import { styles, colors, screenWidth } from '../../styles'


export class ButtonBar extends Component<any, any> {
  render() {
    let barHeight = this.props.barHeight;
    if (this.props.largeIcon)
      barHeight = 75;
    else if (this.props.icon)
      barHeight = 50;


    return (
      <TouchableHighlight onPress={() => {this.props.setActiveElement(); this.props.callback()}}>
        <View style={[styles.listView, {height: barHeight, backgroundColor: this.props.buttonBackground || '#ffffff'}]}>
          {this.props.largeIcon !== undefined ?
            <View style={[styles.centered, {width: 80, paddingRight: 20}]}>{this.props.largeIcon}</View> : undefined}
          {this.props.icon !== undefined ? <View style={[styles.centered, {width:0.12 * screenWidth, paddingRight:15}]}>{this.props.icon}</View> : undefined}
          <Text style={[{fontSize:16, color:colors.menuRed.hex}, this.props.style]}>{this.props.label}</Text>
        </View>
      </TouchableHighlight>
    );
  }
}
