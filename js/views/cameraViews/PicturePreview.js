import React, { Component } from 'react' 
import {
  CameraRoll,
  Image,
  StyleSheet,
  TouchableHighlight,
  TouchableOpacity,
  Text,
  View
} from 'react-native';

import { TopBar } from '../components/Topbar';
var Actions = require('react-native-router-flux').Actions;
import { styles, colors, screenWidth, screenHeight } from '../styles'
import { safeDeleteFile } from '../../util/util'
import RNFS from 'react-native-fs'

export class PicturePreview extends Component {

  render() {
    let imageURI = this.props.image === 'file' ? this.props.image : 'file://' + this.props.image;
    imageURI += '?r=' + Math.random(); // cache buster
    return (
      <View style={{flex:1, screenWidth, screenHeight}} >
        <TopBar title="Review Your Picture" notBack={true} />
        <View style={{flex:1, backgroundColor:'#0f101a', alignItems:'center', justifyContent:'center'}}>
          <Image source={{uri:imageURI}} style={{width: screenWidth, height:screenWidth}}>
            <View style={{position:'absolute', top:0, left:0, backgroundColor:'rgba(0,0,0,0.5)', width:screenWidth, height: screenWidth}} />
            <Image source={{uri:imageURI}} style={{position:'absolute', top:0, left:0, width: screenWidth, height:screenWidth, borderRadius:0.5*width}} />
          </Image>
          <View style={{flexDirection:'row', width: screenWidth, position:'absolute', bottom:0}}>
            <TouchableHighlight onPress={() => {
              safeDeleteFile(this.props.image);
              Actions.pictureView({selectCallback:this.props.selectCallback, type:'replace', camera: this.props.camera});
            }} style={previewStyles.buttons}>
              <Text style={[styles.menuText,{fontWeight:'bold'}]}>Retake</Text>
            </TouchableHighlight>
            <TouchableHighlight onPress={() => {
              this.props.selectCallback(this.props.image);
               Actions.pop();
             }} style={[previewStyles.buttons,{alignItems:'flex-end'}]}>
              <Text style={[styles.menuText,{fontWeight:'bold'}]}>Use Picture</Text>
            </TouchableHighlight>
          </View>
        </View>
      </View>
    );
  }
}

const previewStyles = StyleSheet.create({
  buttons: {
    width:0.5*screenWidth,
    justifyContent:'center',
    alignItems:'flex-start',
    padding:20,
  }
});
