import React, {
  Animated,
  Component,
  Dimensions,
  Image,
  PixelRatio,
  Text,
  View,
} from 'react-native';

import { styles, colors} from '../../styles'

let { width, height } = Dimensions.get('window');

export class AnimatedLoadingBar extends Component {
  constructor(props) {
    super();
    this.width = props.width || width * 0.6;
    this.barHeight = props.height || 30;
    this.borderWidth = 3;
    this.progressTarget = props.progress
    this.state = {progress: new Animated.Value(props.progress || 0)};
  }

  componentWillUpdate() {
    let innerWidth = this.width - 2 * this.borderWidth;
    if (this.props.progress !== this.progressTarget) {
      Animated.spring(this.state.progress, {toValue: innerWidth * this.props.progress, friction:4, tension:40}).start();
      this.progressTarget = this.props.progress;
    }
  }

  render() {
    let innerWidth = this.width - 2 * this.borderWidth;
    let innerHeight = this.barHeight - 2 * this.borderWidth;

    return (
      <View style={{width:this.width, overflow:'hidden', alignItems:'center', justifyContent:'center', height:this.barHeight, borderRadius: 18, margin:20, backgroundColor:'#fff'}}>
        <View style={{width:innerWidth, height:innerHeight, borderRadius: 15, margin:0, backgroundColor:colors.menuBackground.h, overflow:'hidden', alignItems:'flex-start', justifyContent:'center'}}>
          <Animated.View style={{width:this.state.progress, height: innerHeight, backgroundColor:colors.blue.h}} />
        </View>
      </View>
    );
  }
}